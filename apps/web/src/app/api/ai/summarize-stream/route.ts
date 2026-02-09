import type { NextRequest } from "next/server";
import type { UUID } from "@ainotes/core";
import {
  ProcessingJobKind,
  ProcessingJobStatus,
  ArtifactType,
  ArtifactStatus,
} from "@ainotes/core";
import { streamSummarize } from "@ainotes/ai";
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

  let body: { noteId?: string };
  try {
    body = (await request.json()) as { noteId?: string };
  } catch {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid JSON body");
  }

  if (!body.noteId) {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "noteId is required");
  }

  const noteId = body.noteId as UUID;
  const note = await notesRepo.findById(noteId, userId);
  if (!note) return apiError(ApiErrorCode.NOT_FOUND);

  const noteContent = note.contentPlain || "";
  if (!noteContent.trim()) {
    return apiError(
      ApiErrorCode.VALIDATION_ERROR,
      "Note has no content to summarize",
    );
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
          signal: abortController.signal,
        });

        for await (const token of tokenStream) {
          accumulated += token;
          send("token", { token });
        }

        // Streaming complete — save to DB
        const html = await markdownToHtml(accumulated);

        // Update artifacts
        const artifacts = await artifactsRepo.findByJob(job.id);
        for (const artifact of artifacts) {
          if (artifact.type === "MARKDOWN_SUMMARY") {
            await artifactsRepo.update(artifact.id, {
              status: ArtifactStatus.READY,
              storagePath: accumulated,
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
          accumulated,
          note.title,
        );
        await summariesRepo.create({
          noteId,
          meetingSessionId: null,
          kind: "SUMMARY",
          payload: summaryPayload,
          modelInfo: { provider: "groq", model: "llama-3.3-70b-versatile" },
        });

        // Create ACTION_ITEMS if next steps were found
        const actionItems = parseNextSteps(accumulated);
        if (actionItems.length > 0) {
          await summariesRepo.create({
            noteId,
            meetingSessionId: null,
            kind: "ACTION_ITEMS",
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
