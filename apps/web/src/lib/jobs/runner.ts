import type { UUID } from "@ainotes/core";
import { ProcessingJobStatus, ArtifactStatus } from "@ainotes/core";
import {
  prisma,
  createNotesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";
import { generateMarkdownSummary } from "./summarize";
import { markdownToHtml } from "./html-generator";

const notesRepo = createNotesRepository(prisma);
const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

/**
 * Runs a processing job asynchronously (in-process for MVP).
 * Updates job progress and artifact statuses as it processes.
 */
export async function runJobAsync(jobId: UUID): Promise<void> {
  // Fire and forget - catch any errors to prevent unhandled rejections
  runJob(jobId).catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`Job ${jobId} failed with unhandled error:`, error);
  });
}

async function runJob(jobId: UUID): Promise<void> {
  try {
    // 1. Start the job
    await jobsRepo.update(jobId, {
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      progressPct: 0,
      message: "Starting processing...",
    });

    // 2. Get the job and related note
    const job = await jobsRepo.findByIdInternal(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const note = await notesRepo.findByIdInternal(job.noteId);
    if (!note) {
      throw new Error(`Note ${job.noteId} not found`);
    }

    // 3. Update progress - generating summary
    await jobsRepo.update(jobId, {
      progressPct: 20,
      message: "Generating markdown summary...",
    });

    // 4. Generate markdown summary
    const noteContent = note.contentPlain || "";
    const { markdown } = generateMarkdownSummary(note.title, noteContent);

    // 5. Update progress - generating HTML
    await jobsRepo.update(jobId, {
      progressPct: 50,
      message: "Generating HTML summary...",
    });

    // 6. Convert markdown to HTML
    const html = await markdownToHtml(markdown);

    // 7. Update artifacts
    await jobsRepo.update(jobId, {
      progressPct: 80,
      message: "Saving artifacts...",
    });

    // Update markdown artifact
    const artifacts = await artifactsRepo.findByJob(jobId);
    for (const artifact of artifacts) {
      if (artifact.type === "MARKDOWN_SUMMARY") {
        await artifactsRepo.update(artifact.id, {
          status: ArtifactStatus.READY,
          storagePath: markdown, // For MVP, store inline (would be S3/storage path in prod)
        });
      } else if (artifact.type === "HTML_SUMMARY") {
        await artifactsRepo.update(artifact.id, {
          status: ArtifactStatus.READY,
          storagePath: html, // For MVP, store inline
        });
      }
    }

    // 8. Complete the job
    await jobsRepo.update(jobId, {
      status: ProcessingJobStatus.COMPLETED,
      progressPct: 100,
      message: "Processing complete",
      endedAt: new Date(),
    });
  } catch (error: unknown) {
    // Mark job as failed
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await jobsRepo.update(jobId, {
      status: ProcessingJobStatus.FAILED,
      error: errorMessage,
      endedAt: new Date(),
    });

    // Update any pending artifacts to FAILED
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
