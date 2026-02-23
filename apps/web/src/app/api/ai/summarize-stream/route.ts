import type { NextRequest } from "next/server";
import type { UUID } from "@ainotes/core";
import { AI_MODELS, AI_PROVIDER } from "@ainotes/config/ai-models";
import { AISummaryKind } from "@prisma/client";
import {
  ProcessingJobKind,
  ProcessingJobStatus,
  ArtifactType,
  ArtifactStatus,
  SummaryArtifactStatus,
} from "@ainotes/core";
import type { Citation, CreateSummarySectionInput } from "@ainotes/core";
import {
  streamSummarize,
  extractGeneratedTitle,
  stripTitleLine,
  generateSummary,
  regenerateSection,
} from "@ainotes/ai";
import type { TemplateSectionSpec, EvidenceSnippet } from "@ainotes/ai";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createNotesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
  createAISummariesRepository,
  createSummaryArtifactsRepository,
} from "@/lib/db";
import { markdownToHtml } from "@/lib/jobs/html-generator";
import {
  parseMarkdownToSummaryPayload,
  parseNextSteps,
} from "@/lib/jobs/parse-summary";
import { retrieveEvidenceForSections } from "@/lib/summary/evidence-retriever";
import type { NoteForRag } from "@/lib/chat/chunks";

const notesRepo = createNotesRepository(prisma);
const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);
const summariesRepo = createAISummariesRepository(prisma);
const summaryArtifactsRepo = createSummaryArtifactsRepository(prisma);

// ─── Request body types ───

interface SummarizeStreamBody {
  noteId?: string;
  content?: string;
  mode?: "legacy" | "langchain";
  templateId?: string;
  scope?: "all_meeting_sources" | "transcript_only" | "notes_only";
  action?: "generate" | "regenerate-section";
  summaryArtifactId?: string;
  sectionKey?: string;
}

// ─── Helpers ───

function createSSEResponse(
  streamFn: (
    send: (event: string, data: unknown) => void,
    close: () => void,
  ) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const close = () => controller.close();
      await streamFn(send, close);
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

// ─── Route handler ───

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, aiSummaryCount: true },
  });

  if (!user) return apiError(ApiErrorCode.UNAUTHORIZED);

  const IS_ADMIN = user.email === "rakeshtagadghar@gmail.com";
  const MAX_SUMMARIES = 5;

  if (!IS_ADMIN && user.aiSummaryCount >= MAX_SUMMARIES) {
    return apiError(
      ApiErrorCode.FORBIDDEN,
      `You have reached the limit of ${MAX_SUMMARIES} AI summaries. Please contact support to unlock more.`,
    );
  }

  let body: SummarizeStreamBody;
  try {
    body = (await request.json()) as SummarizeStreamBody;
  } catch {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid JSON body");
  }

  if (!body.noteId) {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "noteId is required");
  }

  const noteId = body.noteId as UUID;
  const note = await notesRepo.findById(noteId, userId);
  if (!note) return apiError(ApiErrorCode.NOT_FOUND);

  const noteContent = body.content ?? note.contentPlain ?? "";

  if (!noteContent.trim()) {
    return apiError(
      ApiErrorCode.VALIDATION_ERROR,
      "Note has no content to summarize",
    );
  }

  const mode = body.mode ?? "legacy";

  if (mode === "langchain") {
    return handleLangchainMode(
      request,
      body,
      noteId,
      noteContent,
      userId,
      IS_ADMIN,
      note.title,
      note.templateId as UUID | null,
    );
  }

  // ─── Legacy mode (existing behavior) ───
  return handleLegacyMode(request, noteId, noteContent, userId, IS_ADMIN, note);
}

// ─── Legacy mode ───

async function handleLegacyMode(
  request: NextRequest,
  noteId: UUID,
  noteContent: string,
  userId: string,
  isAdmin: boolean,
  note: { title: string; templateId: UUID | null },
): Promise<Response> {
  const needsTitle =
    !note.title ||
    note.title.toLowerCase() === "untitled note" ||
    note.title.toLowerCase() === "untitled";

  // Delete existing summaries to avoid duplicates
  try {
    await summariesRepo.deleteByNoteAndKind(noteId, AISummaryKind.SUMMARY);
    await summariesRepo.deleteByNoteAndKind(noteId, AISummaryKind.ACTION_ITEMS);
    await artifactsRepo.deleteByNoteAndType(
      noteId,
      ArtifactType.MARKDOWN_SUMMARY,
    );
    await artifactsRepo.deleteByNoteAndType(noteId, ArtifactType.HTML_SUMMARY);
  } catch (error) {
    console.error("Failed to cleanup old summaries/artifacts:", error);
  }

  const job = await jobsRepo.create({
    noteId,
    userId,
    kind: ProcessingJobKind.SUMMARIZE,
  });
  await jobsRepo.update(job.id, {
    status: ProcessingJobStatus.RUNNING,
    startedAt: new Date(),
    progressPct: 0,
    message: "Streaming AI summary...",
  });

  for (const type of [
    ArtifactType.MARKDOWN_SUMMARY,
    ArtifactType.HTML_SUMMARY,
  ]) {
    await artifactsRepo.create({ noteId, jobId: job.id, type });
  }

  let templateContext: string | null = null;
  let templateSections: { title: string; hint?: string | null }[] | undefined;

  if (note.templateId) {
    const template = await prisma.template.findUnique({
      where: { id: note.templateId },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    if (template) {
      templateContext = template.meetingContext;
      templateSections = template.sections.map((s) => ({
        title: s.title,
        hint: s.hint,
      }));
    }
  }

  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  return createSSEResponse(async (send, close) => {
    let accumulated = "";

    try {
      const tokenStream = streamSummarize({
        noteTitle: note.title,
        noteContent,
        needsTitle,
        templateContext,
        templateSections,
        signal: abortController.signal,
      });

      for await (const token of tokenStream) {
        accumulated += token;
        send("token", { token });
      }

      let finalContent = accumulated;
      let generatedTitle: string | null = null;

      if (needsTitle) {
        generatedTitle = extractGeneratedTitle(accumulated);
        if (generatedTitle) {
          await notesRepo.update(noteId, userId, { title: generatedTitle });
          send("titleUpdate", { title: generatedTitle });
          finalContent = stripTitleLine(accumulated);
        }
      }

      const html = await markdownToHtml(finalContent);

      const artifacts = await artifactsRepo.findByJob(job.id);
      for (const artifact of artifacts) {
        if (artifact.type === "MARKDOWN_SUMMARY") {
          await artifactsRepo.update(artifact.id, {
            status: ArtifactStatus.READY,
            storagePath: finalContent,
          });
        } else if (artifact.type === "HTML_SUMMARY") {
          await artifactsRepo.update(artifact.id, {
            status: ArtifactStatus.READY,
            storagePath: html,
          });
        }
      }

      const summaryPayload = parseMarkdownToSummaryPayload(
        finalContent,
        generatedTitle ?? note.title,
      );
      await summariesRepo.create({
        noteId,
        meetingSessionId: null,
        kind: AISummaryKind.SUMMARY,
        payload: summaryPayload,
        modelInfo: {
          provider: AI_PROVIDER.GROQ,
          model: AI_MODELS.groq.chatCompletion,
        },
      });

      const actionItems = parseNextSteps(finalContent);
      if (actionItems.length > 0) {
        await summariesRepo.create({
          noteId,
          meetingSessionId: null,
          kind: AISummaryKind.ACTION_ITEMS,
          payload: { items: actionItems },
          modelInfo: {
            provider: AI_PROVIDER.GROQ,
            model: AI_MODELS.groq.chatCompletion,
          },
        });
      }

      await jobsRepo.update(job.id, {
        status: ProcessingJobStatus.COMPLETED,
        progressPct: 100,
        message: "Summary complete",
        endedAt: new Date(),
      });

      if (!isAdmin) {
        await prisma.user.update({
          where: { id: userId },
          data: { aiSummaryCount: { increment: 1 } },
        });
      }

      send("done", { jobId: job.id });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Summarization failed";

      if (!request.signal.aborted) {
        send("error", { message: errorMessage });
      }

      await jobsRepo.update(job.id, {
        status: ProcessingJobStatus.FAILED,
        error: errorMessage,
        endedAt: new Date(),
      });

      const artifacts = await artifactsRepo.findByJob(job.id);
      for (const artifact of artifacts) {
        if (artifact.status === ArtifactStatus.GENERATING) {
          await artifactsRepo.update(artifact.id, {
            status: ArtifactStatus.FAILED,
          });
        }
      }
    } finally {
      close();
    }
  });
}

// ─── LangChain mode ───

async function handleLangchainMode(
  request: NextRequest,
  body: SummarizeStreamBody,
  noteId: UUID,
  noteContent: string,
  userId: string,
  isAdmin: boolean,
  noteTitle: string,
  noteTemplateId: UUID | null,
): Promise<Response> {
  const action = body.action ?? "generate";
  const templateId = (body.templateId as UUID) ?? noteTemplateId;

  if (action === "regenerate-section") {
    return handleLangchainRegenSection(
      request,
      body,
      noteId,
      noteContent,
      userId,
      noteTitle,
    );
  }

  // ─── Generate full summary ───
  if (!templateId) {
    return apiError(
      ApiErrorCode.VALIDATION_ERROR,
      "templateId is required for langchain mode. Assign a template to the note or provide templateId.",
    );
  }

  // Load template with sections
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  if (!template) {
    return apiError(ApiErrorCode.NOT_FOUND, "Template not found");
  }

  // Convert template sections to TemplateSectionSpec
  const templateSections: TemplateSectionSpec[] = template.sections.map((s) => {
    const meta = (s.metadata ?? {}) as Record<string, unknown>;
    return {
      key: (meta.key as string) ?? s.title.toLowerCase().replace(/\s+/g, "_"),
      title: s.title,
      format: (meta.format as string) ?? "freeform",
      required: (meta.required as boolean) ?? true,
      instructions: s.hint ?? s.title,
      maxItems: meta.maxItems as number | undefined,
    };
  });

  // Load note with meeting sessions and transcripts for evidence retrieval
  const noteForRag = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      meetingSessions: {
        include: {
          transcriptChunks: {
            orderBy: { tStartMs: "asc" },
          },
        },
      },
      summaries: true,
    },
  });

  if (!noteForRag) {
    return apiError(ApiErrorCode.NOT_FOUND);
  }

  // Build NoteForRag structure
  const notesForRetrieval: NoteForRag[] = [
    {
      id: noteForRag.id,
      title: noteForRag.title,
      contentPlain: noteContent,
      updatedAt: noteForRag.updatedAt,
      createdAt: noteForRag.createdAt,
      meetingSessions: noteForRag.meetingSessions.map((ms) => ({
        id: ms.id,
        startedAt: ms.startedAt,
        transcriptChunks: ms.transcriptChunks.map((tc) => ({
          id: tc.id,
          text: tc.text,
          tStartMs: tc.tStartMs,
          tEndMs: tc.tEndMs,
          createdAt: tc.createdAt,
        })),
      })),
      summaries: noteForRag.summaries.map((s) => ({
        id: s.id,
        kind: s.kind,
        payload: s.payload,
        createdAt: s.createdAt,
      })),
    },
  ];

  // Clean up previous summaries/artifacts
  try {
    await summariesRepo.deleteByNoteAndKind(noteId, AISummaryKind.SUMMARY);
    await summariesRepo.deleteByNoteAndKind(noteId, AISummaryKind.ACTION_ITEMS);
    await artifactsRepo.deleteByNoteAndType(
      noteId,
      ArtifactType.MARKDOWN_SUMMARY,
    );
    await artifactsRepo.deleteByNoteAndType(noteId, ArtifactType.HTML_SUMMARY);
  } catch (error) {
    console.error("Failed to cleanup old summaries/artifacts:", error);
  }

  // Create job
  const job = await jobsRepo.create({
    noteId,
    userId,
    kind: ProcessingJobKind.SUMMARIZE,
  });
  await jobsRepo.update(job.id, {
    status: ProcessingJobStatus.RUNNING,
    startedAt: new Date(),
    progressPct: 0,
    message: "Generating LangChain summary...",
  });

  for (const type of [
    ArtifactType.MARKDOWN_SUMMARY,
    ArtifactType.HTML_SUMMARY,
  ]) {
    await artifactsRepo.create({ noteId, jobId: job.id, type });
  }

  return createSSEResponse(async (send, close) => {
    try {
      // Retrieve evidence
      send("progress", { pct: 10, message: "Retrieving evidence..." });

      const { evidenceBySection } = await retrieveEvidenceForSections(
        userId,
        [noteId],
        notesForRetrieval,
        templateSections,
        noteTitle || "Meeting",
      );

      send("progress", { pct: 20, message: "Generating sections..." });

      // Generate summary via LangChain orchestrator
      const result = await generateSummary({
        meetingMeta: {
          title: noteTitle || "Meeting",
          participants:
            noteForRag.meetingSessions[0]?.participants ?? undefined,
        },
        templateSections,
        evidenceBySection,
      });

      // Stream the combined markdown as tokens (compatible with existing UI)
      const combinedMarkdown = result.combinedMarkdown;
      // Send in chunks to simulate streaming
      const chunkSize = 50;
      for (let i = 0; i < combinedMarkdown.length; i += chunkSize) {
        const token = combinedMarkdown.slice(i, i + chunkSize);
        send("token", { token });
      }

      send("progress", { pct: 80, message: "Saving results..." });

      // Persist SummaryArtifact with sections
      const meetingSessionId = noteForRag.meetingSessions[0]?.id as
        | UUID
        | undefined;
      const sections: CreateSummarySectionInput[] = result.sections.map(
        (s, i) => ({
          key: s.key,
          title: s.title,
          contentMarkdown: s.contentMarkdown,
          citations: s.citations.map(
            (c): Citation => ({
              citationId: c.citationId,
              sourceType: c.chunkId.startsWith("transcript:")
                ? "transcript"
                : c.chunkId.startsWith("note:")
                  ? "note"
                  : "ai_summary",
              noteId: noteId,
              meetingSessionId: (meetingSessionId as UUID) ?? null,
              chunkId: c.chunkId,
              title: s.title,
              snippet: c.snippet,
              timeRange: c.timeRange,
              score: c.score,
            }),
          ),
          order: i,
          warnings: s.warnings,
        }),
      );

      const summaryArtifact = await summaryArtifactsRepo.create({
        noteId,
        meetingSessionId: meetingSessionId ?? null,
        templateId: templateId,
        scope: body.scope ?? "all_meeting_sources",
        modelInfo: result.modelInfo,
        sections,
      });

      await summaryArtifactsRepo.updateStatus(
        summaryArtifact.id,
        SummaryArtifactStatus.READY,
      );

      // Also create legacy artifacts for backward compat with SummaryPanel
      const html = await markdownToHtml(combinedMarkdown);
      const artifacts = await artifactsRepo.findByJob(job.id);
      for (const artifact of artifacts) {
        if (artifact.type === "MARKDOWN_SUMMARY") {
          await artifactsRepo.update(artifact.id, {
            status: ArtifactStatus.READY,
            storagePath: combinedMarkdown,
          });
        } else if (artifact.type === "HTML_SUMMARY") {
          await artifactsRepo.update(artifact.id, {
            status: ArtifactStatus.READY,
            storagePath: html,
          });
        }
      }

      // Create legacy AISummary records
      const summaryPayload = parseMarkdownToSummaryPayload(
        combinedMarkdown,
        noteTitle,
      );
      await summariesRepo.create({
        noteId,
        meetingSessionId: meetingSessionId ?? null,
        kind: AISummaryKind.SUMMARY,
        payload: summaryPayload,
        modelInfo: result.modelInfo,
      });

      const actionItems = parseNextSteps(combinedMarkdown);
      if (actionItems.length > 0) {
        await summariesRepo.create({
          noteId,
          meetingSessionId: meetingSessionId ?? null,
          kind: AISummaryKind.ACTION_ITEMS,
          payload: { items: actionItems },
          modelInfo: result.modelInfo,
        });
      }

      await jobsRepo.update(job.id, {
        status: ProcessingJobStatus.COMPLETED,
        progressPct: 100,
        message: "Summary complete",
        endedAt: new Date(),
      });

      if (!isAdmin) {
        await prisma.user.update({
          where: { id: userId },
          data: { aiSummaryCount: { increment: 1 } },
        });
      }

      send("done", {
        jobId: job.id,
        summaryArtifactId: summaryArtifact.id,
        version: summaryArtifact.version,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "LangChain summarization failed";

      if (!request.signal.aborted) {
        send("error", { message: errorMessage });
      }

      await jobsRepo.update(job.id, {
        status: ProcessingJobStatus.FAILED,
        error: errorMessage,
        endedAt: new Date(),
      });

      const artifacts = await artifactsRepo.findByJob(job.id);
      for (const artifact of artifacts) {
        if (artifact.status === ArtifactStatus.GENERATING) {
          await artifactsRepo.update(artifact.id, {
            status: ArtifactStatus.FAILED,
          });
        }
      }
    } finally {
      close();
    }
  });
}

// ─── LangChain section regeneration ───

async function handleLangchainRegenSection(
  request: NextRequest,
  body: SummarizeStreamBody,
  noteId: UUID,
  noteContent: string,
  userId: string,
  noteTitle: string,
): Promise<Response> {
  if (!body.summaryArtifactId || !body.sectionKey) {
    return apiError(
      ApiErrorCode.VALIDATION_ERROR,
      "summaryArtifactId and sectionKey are required for regenerate-section",
    );
  }

  const summaryArtifactId = body.summaryArtifactId as UUID;
  const artifact = await summaryArtifactsRepo.findById(summaryArtifactId);

  if (!artifact || artifact.noteId !== noteId) {
    return apiError(ApiErrorCode.NOT_FOUND, "Summary artifact not found");
  }

  const section = artifact.sections.find((s) => s.key === body.sectionKey);
  if (!section) {
    return apiError(ApiErrorCode.NOT_FOUND, "Section not found");
  }

  if (section.locked) {
    return apiError(ApiErrorCode.FORBIDDEN, "Section is locked");
  }

  // Load template section spec
  const template = artifact.templateId
    ? await prisma.template.findUnique({
        where: { id: artifact.templateId },
        include: { sections: { orderBy: { order: "asc" } } },
      })
    : null;

  const templateSectionRow = template?.sections.find((s) => {
    const meta = (s.metadata ?? {}) as Record<string, unknown>;
    const key =
      (meta.key as string) ?? s.title.toLowerCase().replace(/\s+/g, "_");
    return key === body.sectionKey;
  });

  if (!templateSectionRow) {
    return apiError(ApiErrorCode.NOT_FOUND, "Template section not found");
  }

  const meta = (templateSectionRow.metadata ?? {}) as Record<string, unknown>;
  const templateSection: TemplateSectionSpec = {
    key:
      (meta.key as string) ??
      templateSectionRow.title.toLowerCase().replace(/\s+/g, "_"),
    title: templateSectionRow.title,
    format: (meta.format as string) ?? "freeform",
    required: (meta.required as boolean) ?? true,
    instructions: templateSectionRow.hint ?? templateSectionRow.title,
    maxItems: meta.maxItems as number | undefined,
  };

  // Retrieve evidence for this section
  const noteForRag = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      meetingSessions: {
        include: { transcriptChunks: { orderBy: { tStartMs: "asc" } } },
      },
      summaries: true,
    },
  });

  if (!noteForRag) {
    return apiError(ApiErrorCode.NOT_FOUND);
  }

  const notesForRetrieval: NoteForRag[] = [
    {
      id: noteForRag.id,
      title: noteForRag.title,
      contentPlain: noteContent,
      updatedAt: noteForRag.updatedAt,
      createdAt: noteForRag.createdAt,
      meetingSessions: noteForRag.meetingSessions.map((ms) => ({
        id: ms.id,
        startedAt: ms.startedAt,
        transcriptChunks: ms.transcriptChunks.map((tc) => ({
          id: tc.id,
          text: tc.text,
          tStartMs: tc.tStartMs,
          tEndMs: tc.tEndMs,
          createdAt: tc.createdAt,
        })),
      })),
      summaries: noteForRag.summaries.map((s) => ({
        id: s.id,
        kind: s.kind,
        payload: s.payload,
        createdAt: s.createdAt,
      })),
    },
  ];

  const { evidenceBySection } = await retrieveEvidenceForSections(
    userId,
    [noteId],
    notesForRetrieval,
    [templateSection],
    noteTitle || "Meeting",
  );

  const evidence: EvidenceSnippet[] = [
    ...(evidenceBySection[body.sectionKey!] ?? []),
    ...(evidenceBySection["*"] ?? []),
  ];

  return createSSEResponse(async (send, close) => {
    try {
      send("section-start", { key: section.key, title: section.title });

      const result = await regenerateSection({
        meetingMeta: { title: noteTitle || "Meeting" },
        templateSection,
        evidence,
      });

      // Stream the section content
      const chunkSize = 50;
      for (let i = 0; i < result.contentMarkdown.length; i += chunkSize) {
        send("token", {
          token: result.contentMarkdown.slice(i, i + chunkSize),
        });
      }

      // Persist updated section
      await summaryArtifactsRepo.incrementSectionVersion(
        section.id,
        result.contentMarkdown,
        result.citations.map(
          (c): Citation => ({
            citationId: c.citationId,
            sourceType: c.chunkId.startsWith("transcript:")
              ? "transcript"
              : c.chunkId.startsWith("note:")
                ? "note"
                : "ai_summary",
            noteId: noteId,
            meetingSessionId: null,
            chunkId: c.chunkId,
            title: section.title,
            snippet: c.snippet,
            timeRange: c.timeRange,
            score: c.score,
          }),
        ),
        result.warnings,
      );

      send("section-complete", {
        key: section.key,
        section: {
          contentMarkdown: result.contentMarkdown,
          citations: result.citations,
          warnings: result.warnings,
        },
      });

      send("done", { summaryArtifactId: artifact.id });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Section regeneration failed";
      if (!request.signal.aborted) {
        send("error", { message: errorMessage });
      }
    } finally {
      close();
    }
  });
}
