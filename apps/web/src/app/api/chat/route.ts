import type { NextRequest } from "next/server";
import { getGroqClient } from "@ainotes/ai";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { ChatCitation, ChatRequestBody } from "@/features/chat/types";
import { extractRagChunks } from "@/lib/chat/chunks";
import {
  isSemanticSearchEnabled,
  queryVectorSimilarityScores,
  syncNoteChunksToVectorStore,
} from "@/lib/chat/vector-store";
import {
  buildCitations,
  buildContextBlock,
  buildNoteWhere,
  isLowConfidence,
  lowConfidenceMessage,
  noResultsMessage,
  normalizeMode,
  normalizeScope,
  rankChunks,
  type NoteForRag,
} from "./_lib/rag";
import {
  normalizeDbMode,
  normalizeDbScope,
  sessionTitleFromMessage,
  type ChatMessageRow,
  type ChatSessionRow,
} from "./_lib/sessions";

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

interface SessionResolution {
  id: string;
  scope: ReturnType<typeof normalizeScope>;
  mode: ReturnType<typeof normalizeMode>;
  title: string;
}

async function fetchNotesForChat(
  userId: string,
  userEmail: string | null,
  scope: ReturnType<typeof normalizeScope>,
  body: ChatRequestBody,
): Promise<NoteForRag[]> {
  const where = buildNoteWhere({
    userId,
    userEmail,
    scope,
    filters: body.filters,
    query: undefined,
  });

  return prisma.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      contentPlain: true,
      createdAt: true,
      updatedAt: true,
      summaries: {
        select: {
          id: true,
          kind: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      meetingSessions: {
        select: {
          id: true,
          startedAt: true,
          transcriptChunks: {
            select: {
              id: true,
              text: true,
              tStartMs: true,
              tEndMs: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 40,
          },
        },
        orderBy: { startedAt: "desc" },
        take: 3,
      },
    },
  });
}

async function findSessionForUser(
  sessionId: string,
  userId: string,
): Promise<ChatSessionRow | null> {
  const rows = await prisma.$queryRawUnsafe<ChatSessionRow[]>(
    `
    SELECT
      id,
      title,
      scope,
      mode,
      filters,
      created_at,
      updated_at
    FROM chat_sessions
    WHERE id = $1::uuid
      AND user_id = $2::uuid
    LIMIT 1
    `,
    sessionId,
    userId,
  );

  return rows[0] ?? null;
}

async function resolveSession(
  userId: string,
  body: ChatRequestBody,
): Promise<SessionResolution> {
  const requestedScope = normalizeScope(body.scope);
  const requestedMode = normalizeMode(body.mode);
  const conversationId = body.conversationId?.trim();

  if (conversationId) {
    const existing = await findSessionForUser(conversationId, userId);
    if (existing) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE chat_sessions
        SET
          scope = $1,
          mode = $2,
          filters = $3::jsonb,
          updated_at = NOW()
        WHERE id = $4::uuid
          AND user_id = $5::uuid
        `,
        requestedScope,
        requestedMode,
        JSON.stringify(body.filters ?? {}),
        conversationId,
        userId,
      );

      return {
        id: conversationId,
        scope: requestedScope,
        mode: requestedMode,
        title: existing.title,
      };
    }
  }

  const rows = await prisma.$queryRawUnsafe<ChatSessionRow[]>(
    `
    INSERT INTO chat_sessions (
      user_id,
      title,
      scope,
      mode,
      filters
    ) VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5::jsonb
    )
    RETURNING
      id,
      title,
      scope,
      mode,
      filters,
      created_at,
      updated_at
    `,
    userId,
    sessionTitleFromMessage(body.message),
    requestedScope,
    requestedMode,
    JSON.stringify(body.filters ?? {}),
  );

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create chat session");
  }

  return {
    id: created.id,
    scope: normalizeDbScope(created.scope),
    mode: normalizeDbMode(created.mode),
    title: created.title,
  };
}

async function fetchConversationHistory(
  sessionId: string,
  userId: string,
  limit = 20,
): Promise<ConversationTurn[]> {
  const rows = await prisma.$queryRawUnsafe<ChatMessageRow[]>(
    `
    SELECT
      id,
      role,
      content,
      citations,
      created_at
    FROM chat_messages
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
    ORDER BY created_at DESC
    LIMIT $3
    `,
    sessionId,
    userId,
    limit,
  );

  return rows
    .reverse()
    .map(
      (row): ConversationTurn => ({
        role: row.role === "user" ? "user" : "assistant",
        content: row.content,
      }),
    )
    .filter((row) => row.content.trim().length > 0);
}

async function insertSessionMessage(params: {
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO chat_messages (
      session_id,
      user_id,
      role,
      content,
      citations
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      $5::jsonb
    )
    `,
    params.sessionId,
    params.userId,
    params.role,
    params.content,
    JSON.stringify(params.citations ?? null),
  );

  await prisma.$executeRawUnsafe(
    `
    UPDATE chat_sessions
    SET updated_at = NOW()
    WHERE id = $1::uuid
      AND user_id = $2::uuid
    `,
    params.sessionId,
    params.userId,
  );
}

async function streamFallbackText(
  text: string,
  send: (event: string, payload: unknown) => void,
): Promise<void> {
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    send("token", { text: part });
  }
}

function buildFallbackAnswer(
  mode: ReturnType<typeof normalizeMode>,
  question: string,
  citations: ReturnType<typeof buildCitations>,
): string {
  const top = citations.slice(0, 3);
  if (top.length === 0) {
    return "I couldn't find enough context in your notes. Try broadening your scope.";
  }

  if (mode === "action_items") {
    const items = top.map(
      (citation) => `- ${citation.snippet} [${citation.citation_id}]`,
    );
    return `Potential action items from your notes:\n${items.join("\n")}`;
  }

  if (mode === "email_draft") {
    const bullets = top
      .map((citation) => `- ${citation.snippet} [${citation.citation_id}]`)
      .join("\n");
    return `Subject: Follow-up from notes\n\nHi team,\n\nHere is a short update based on my notes:\n${bullets}\n\nThanks.`;
  }

  if (mode === "summarize") {
    const summaryLines = top.map(
      (citation) => `- ${citation.snippet} [${citation.citation_id}]`,
    );
    return `Summary from your notes:\n${summaryLines.join("\n")}`;
  }

  return `Based on your notes, here are the most relevant points for "${question}":\n${top
    .map((citation) => `- ${citation.snippet} [${citation.citation_id}]`)
    .join("\n")}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid JSON body");
  }

  const message = body.message?.trim();
  if (!message) {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "message is required");
  }

  let session: SessionResolution;
  try {
    session = await resolveSession(userId, { ...body, message });
  } catch (error: unknown) {
    const messageText =
      error instanceof Error ? error.message : "Failed to resolve chat session";
    return apiError(ApiErrorCode.INTERNAL_ERROR, messageText);
  }

  const { id: conversationId, scope, mode } = session;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const history = await fetchConversationHistory(conversationId, userId, 20);
  await insertSessionMessage({
    sessionId: conversationId,
    userId,
    role: "user",
    content: message,
  });

  const notes = await fetchNotesForChat(userId, user?.email ?? null, scope, {
    ...body,
    message,
  });

  let vectorScores: Map<string, number> | undefined;
  if (isSemanticSearchEnabled() && notes.length > 0) {
    try {
      const chunks = extractRagChunks(notes);
      await syncNoteChunksToVectorStore(userId, chunks);
      vectorScores = await queryVectorSimilarityScores(
        userId,
        notes.map((note) => note.id),
        message,
        96,
      );
    } catch {
      vectorScores = undefined;
    }
  }

  const ranked = rankChunks(notes, message, 8, {
    vectorScores,
    hybridWeights: { lexical: 0.4, vector: 0.6 },
  });
  const citations = buildCitations(ranked, message, 5);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
          ),
        );
      };

      try {
        send("status", { message: "Searching your notes..." });

        if (citations.length > 0) {
          send("citations", { citations });
        }

        let answer = "";

        if (ranked.length === 0) {
          answer = noResultsMessage(scope);
          await streamFallbackText(answer, send);
          await insertSessionMessage({
            sessionId: conversationId,
            userId,
            role: "assistant",
            content: answer,
            citations,
          });
          send("done", { conversationId });
          return;
        }

        if (isLowConfidence(ranked)) {
          answer = lowConfidenceMessage(citations);
          await streamFallbackText(answer, send);
          await insertSessionMessage({
            sessionId: conversationId,
            userId,
            role: "assistant",
            content: answer,
            citations,
          });
          send("done", { conversationId });
          return;
        }

        send("status", { message: "Generating grounded answer..." });

        const context = buildContextBlock(citations, ranked);
        const systemPrompt =
          "You are a notes assistant. Answer only from provided context. If the answer is not present, say you could not find it and suggest broadening scope. Every factual claim must include a citation id like [c1]. Respond in markdown.";

        const modeInstruction =
          mode === "summarize"
            ? "Return a concise summary."
            : mode === "action_items"
              ? "Extract action items with checkboxes."
              : mode === "email_draft"
                ? "Draft an email response."
                : "Answer as direct Q&A.";

        if (process.env.GROQ_API_KEY) {
          const client = getGroqClient();
          const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            stream: true,
            max_completion_tokens: 1400,
            messages: [
              { role: "system", content: systemPrompt },
              ...history.map((turn) => ({
                role: turn.role,
                content: turn.content,
              })),
              {
                role: "user",
                content: `${modeInstruction}\n\nQuestion:\n${message}\n\nContext:\n${context}`,
              },
            ],
          });

          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content;
            if (!token) continue;
            answer += token;
            send("token", { text: token });
          }
        } else {
          answer = buildFallbackAnswer(mode, message, citations);
          await streamFallbackText(answer, send);
        }

        await insertSessionMessage({
          sessionId: conversationId,
          userId,
          role: "assistant",
          content: answer,
          citations,
        });
        send("done", { conversationId });
      } catch (error: unknown) {
        const messageText =
          error instanceof Error ? error.message : "Failed to generate answer";
        send("error", { error: messageText });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
