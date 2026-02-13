import type { NextRequest } from "next/server";
import type { UUID } from "@ainotes/core";
import { AISummaryKind } from "@prisma/client";
import {
  ProcessingJobKind,
  ProcessingJobStatus,
  ArtifactType,
  ArtifactStatus,
} from "@ainotes/core";
import {
  streamSummarize,
  extractGeneratedTitle,
  stripTitleLine,
} from "@ainotes/ai";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createNotesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
  createAISummariesRepository,
} from "@/lib/db";
import { markdownToHtml } from "@/lib/jobs/html-generator";
import {
  parseMarkdownToSummaryPayload,
  parseNextSteps,
} from "@/lib/jobs/parse-summary";

const notesRepo = createNotesRepository(prisma);
const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);
const summariesRepo = createAISummariesRepository(prisma);

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

  let body: { noteId?: string; content?: string };
  try {
    body = (await request.json()) as { noteId?: string; content?: string };
  } catch {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid JSON body");
  }

  if (!body.noteId) {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "noteId is required");
  }

  const noteId = body.noteId as UUID;
  const note = await notesRepo.findById(noteId, userId);
  if (!note) return apiError(ApiErrorCode.NOT_FOUND);

  // Use content from body if provided (avoids race conditions), otherwise from DB
  const noteContent = body.content ?? note.contentPlain ?? "";

  if (!noteContent.trim()) {
    return apiError(
      ApiErrorCode.VALIDATION_ERROR,
      "Note has no content to summarize",
    );
  }

  // Check if note needs a title
  const needsTitle =
    !note.title ||
    note.title.toLowerCase() === "untitled note" ||
    note.title.toLowerCase() === "untitled";

  // Delete existing summaries to avoid duplicates
  try {
    // We need to cast to any or import AISummaryKind if strict typing is enforced,
    // but strings "SUMMARY" and "ACTION_ITEMS" match the enum.
    await summariesRepo.deleteByNoteAndKind(noteId, AISummaryKind.SUMMARY);
    await summariesRepo.deleteByNoteAndKind(noteId, AISummaryKind.ACTION_ITEMS);

    // Also cleanup old artifacts
    await artifactsRepo.deleteByNoteAndType(
      noteId,
      ArtifactType.MARKDOWN_SUMMARY,
    );
    await artifactsRepo.deleteByNoteAndType(noteId, ArtifactType.HTML_SUMMARY);
  } catch (error) {
    console.error("Failed to cleanup old summaries/artifacts:", error);
    // Continue anyway
  }

  // Create job + artifacts for audit trail
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

  // Set up abort controller linked to client disconnect
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let accumulated = "";

      try {
        const tokenStream = streamSummarize({
          noteTitle: note.title,
          noteContent,
          needsTitle,
          signal: abortController.signal,
        });

        for await (const token of tokenStream) {
          accumulated += token;
          send("token", { token });
        }

        // Streaming complete — process the response
        let finalContent = accumulated;
        let generatedTitle: string | null = null;

        // If we asked for a title, extract it and update the note
        if (needsTitle) {
          generatedTitle = extractGeneratedTitle(accumulated);
          if (generatedTitle) {
            // Save title to database
            await notesRepo.update(noteId, userId, { title: generatedTitle });
            // Send title update event to client
            send("titleUpdate", { title: generatedTitle });
            // Strip title line from content for storage
            finalContent = stripTitleLine(accumulated);
          }
        }

        const html = await markdownToHtml(finalContent);

        // Update artifacts
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

        // Create AISummary entity (SUMMARY kind) for SummaryPanel
        const summaryPayload = parseMarkdownToSummaryPayload(
          finalContent,
          generatedTitle ?? note.title,
        );
        await summariesRepo.create({
          noteId,
          meetingSessionId: null,
          kind: AISummaryKind.SUMMARY,
          payload: summaryPayload,
          modelInfo: { provider: "groq", model: "llama-3.3-70b-versatile" },
        });

        // Create ACTION_ITEMS if next steps were found
        const actionItems = parseNextSteps(finalContent);
        if (actionItems.length > 0) {
          await summariesRepo.create({
            noteId,
            meetingSessionId: null,
            kind: AISummaryKind.ACTION_ITEMS,
            payload: { items: actionItems },
            modelInfo: { provider: "groq", model: "llama-3.3-70b-versatile" },
          });
        }

        // Mark job as completed
        await jobsRepo.update(job.id, {
          status: ProcessingJobStatus.COMPLETED,
          progressPct: 100,
          message: "Summary complete",
          endedAt: new Date(),
        });

        // Increment usage count
        if (!IS_ADMIN) {
          await prisma.user.update({
            where: { id: userId },
            data: { aiSummaryCount: { increment: 1 } },
          });
        }

        send("done", { jobId: job.id });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Summarization failed";

        // Only send error if client is still connected
        if (!request.signal.aborted) {
          send("error", { message: errorMessage });
        }

        await jobsRepo.update(job.id, {
          status: ProcessingJobStatus.FAILED,
          error: errorMessage,
          endedAt: new Date(),
        });

        // Fail pending artifacts
        const artifacts = await artifactsRepo.findByJob(job.id);
        for (const artifact of artifacts) {
          if (artifact.status === ArtifactStatus.GENERATING) {
            await artifactsRepo.update(artifact.id, {
              status: ArtifactStatus.FAILED,
            });
          }
        }
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
