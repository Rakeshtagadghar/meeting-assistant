import type { UUID } from "@ainotes/core";
import { ProcessingJobStatus, ArtifactStatus } from "@ainotes/core";
import {
  prisma,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";

const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

/**
 * Runs a processing job asynchronously (in-process for MVP).
 * Note: AI summarization now uses the streaming route (/api/ai/summarize-stream).
 * This runner is kept for non-AI jobs like PDF/DOCX export.
 */
export async function runJobAsync(jobId: UUID): Promise<void> {
  runJob(jobId).catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`Job ${jobId} failed with unhandled error:`, error);
  });
}

async function runJob(jobId: UUID): Promise<void> {
  try {
    await jobsRepo.update(jobId, {
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      progressPct: 0,
      message: "Starting processing...",
    });

    const job = await jobsRepo.findByIdInternal(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // TODO: Implement export jobs (PDF, DOCX) here
    throw new Error(
      `Job kind "${job.kind}" is not supported by the background runner. ` +
        "AI summarization uses the streaming endpoint.",
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await jobsRepo.update(jobId, {
      status: ProcessingJobStatus.FAILED,
      error: errorMessage,
      endedAt: new Date(),
    });

    const artifacts = await artifactsRepo.findByJob(jobId);
    for (const artifact of artifacts) {
      if (artifact.status === ArtifactStatus.GENERATING) {
        await artifactsRepo.update(artifact.id, {
          status: ArtifactStatus.FAILED,
        });
      }
    }
  }
}
