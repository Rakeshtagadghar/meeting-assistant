import type { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { ChatFilters, ChatScope } from "@/features/chat/types";
import { extractRagChunks } from "@/lib/chat/chunks";
import {
  isSemanticSearchEnabled,
  queryVectorSimilarityScores,
  syncNoteChunksToVectorStore,
} from "@/lib/chat/vector-store";
import {
  buildCitations,
  buildNoteWhere,
  normalizeScope,
  rankChunks,
} from "../_lib/rag";

interface SearchBody {
  query?: string;
  scope?: ChatScope;
  filters?: ChatFilters;
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  let body: SearchBody;
  try {
    body = (await request.json()) as SearchBody;
  } catch {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid JSON body");
  }

  const query = body.query?.trim() ?? "";
  const scope = normalizeScope(body.scope);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const where = buildNoteWhere({
    userId,
    userEmail: user?.email ?? null,
    scope,
    filters: body.filters,
    query: undefined,
  });

  const notes = await prisma.note.findMany({
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

  let vectorScores: Map<string, number> | undefined;
  if (isSemanticSearchEnabled() && notes.length > 0 && query.length > 0) {
    try {
      const chunks = extractRagChunks(notes);
      await syncNoteChunksToVectorStore(userId, chunks);
      vectorScores = await queryVectorSimilarityScores(
        userId,
        notes.map((note) => note.id),
        query,
        96,
      );
    } catch {
      vectorScores = undefined;
    }
  }

  const ranked = rankChunks(notes, query, 8, {
    vectorScores,
    hybridWeights: { lexical: 0.4, vector: 0.6 },
  });
  const citations = buildCitations(ranked, query, 8);
  const scoreByCitationId = new Map(
    ranked.map((chunk, index) => [`c${index + 1}`, chunk.score]),
  );

  return Response.json({
    results: citations.map((citation) => ({
      noteId: citation.noteId,
      title: citation.title,
      sourceType: citation.sourceType,
      snippet: citation.snippet,
      score: Number(
        (scoreByCitationId.get(citation.citation_id) ?? 0).toFixed(3),
      ),
      ...(citation.time_range_optional
        ? { timeRange: citation.time_range_optional }
        : {}),
    })),
  });
}
