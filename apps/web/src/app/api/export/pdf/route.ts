import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UUID } from "@ainotes/core";
import { ArtifactType, ArtifactStatus, ProcessingJobKind } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createNotesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";

const notesRepo = createNotesRepository(prisma);
const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  try {
    const body = (await request.json()) as { noteId?: string };

    if (!body.noteId) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "noteId is required");
    }

    const noteId = body.noteId as UUID;

    const note = await notesRepo.findById(noteId, userId);
    if (!note) return apiError(ApiErrorCode.NOT_FOUND);

    // Check that HTML_SUMMARY is READY before allowing PDF export
    const htmlArtifact = await artifactsRepo.findByNoteAndType(
      noteId,
      ArtifactType.HTML_SUMMARY,
    );
    if (!htmlArtifact || htmlArtifact.status !== ArtifactStatus.READY) {
      return apiError(
        ApiErrorCode.CONFLICT,
        "HTML summary must be ready before exporting to PDF",
      );
    }

    // Create export job + artifact
    const job = await jobsRepo.create({
      noteId,
      userId,
      kind: ProcessingJobKind.EXPORT_PDF,
    });

    await artifactsRepo.create({
      noteId,
      jobId: job.id,
      type: ArtifactType.PDF,
    });

    // TODO: Kick off PDF generation (Phase 3F job runner)

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/export/pdf error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
