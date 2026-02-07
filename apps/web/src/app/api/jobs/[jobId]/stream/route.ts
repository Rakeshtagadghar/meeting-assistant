import type { NextRequest } from "next/server";
import type { UUID } from "@ainotes/core";
import { isTerminalStatus } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";

const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const { jobId } = await params;

  const job = await jobsRepo.findById(jobId as UUID, userId);
  if (!job) return apiError(ApiErrorCode.NOT_FOUND);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const startTime = Date.now();
      let done = false;

      while (!done) {
        // Check if client disconnected
        if (request.signal.aborted) {
          done = true;
          break;
        }

        // Timeout guard
        if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
          send("error", { message: "Stream timeout" });
          done = true;
          break;
        }

        const currentJob = await jobsRepo.findById(jobId as UUID, userId);
        if (!currentJob) {
          send("error", { message: "Job not found" });
          done = true;
          break;
        }

        send("progress", {
          progressPct: currentJob.progressPct,
          message: currentJob.message,
          status: currentJob.status,
        });

        if (isTerminalStatus(currentJob.status)) {
          const artifacts = await artifactsRepo.findByJob(currentJob.id);
          send("done", {
            status: currentJob.status,
            artifacts,
          });
          done = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      controller.close();
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
