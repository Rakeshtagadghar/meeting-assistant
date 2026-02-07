import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UUID } from "@ainotes/core";
import { ProcessingJobKind, ArtifactType } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createNotesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";
import { runJobAsync } from "@/lib/jobs";

const notesRepo = createNotesRepository(prisma);
const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  try {
    const body = (await request.json()) as {
      noteId?: string;
      kinds?: string[];
    };

    if (!body.noteId) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "noteId is required");
    }

    const noteId = body.noteId as UUID;

    // Verify the note exists and belongs to user
    const note = await notesRepo.findById(noteId, userId);
    if (!note) return apiError(ApiErrorCode.NOT_FOUND);

    // Default kinds: SUMMARIZE + GENERATE_HTML
    const kinds = (body.kinds ?? [
      ProcessingJobKind.SUMMARIZE,
      ProcessingJobKind.GENERATE_HTML,
    ]) as (typeof ProcessingJobKind)[keyof typeof ProcessingJobKind][];

    // Create the processing job (use first kind; multi-kind is a single pipeline)
    const job = await jobsRepo.create({
      noteId,
      userId,
      kind: kinds[0] ?? ProcessingJobKind.SUMMARIZE,
    });

    // Create artifacts for expected outputs
    const artifactTypes: (typeof ArtifactType)[keyof typeof ArtifactType][] =
      [];
    if (kinds.includes(ProcessingJobKind.SUMMARIZE)) {
      artifactTypes.push(ArtifactType.MARKDOWN_SUMMARY);
    }
    if (kinds.includes(ProcessingJobKind.GENERATE_HTML)) {
      artifactTypes.push(ArtifactType.HTML_SUMMARY);
    }

    for (const type of artifactTypes) {
      await artifactsRepo.create({
        noteId,
        jobId: job.id,
        type,
      });
    }

    // Kick off async processing (in-process for MVP)
    void runJobAsync(job.id);

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("POST /api/ai/generate error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
