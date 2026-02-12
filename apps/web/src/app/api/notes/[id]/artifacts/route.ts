import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  prisma,
  createNotesRepository,
  createArtifactsRepository,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { ArtifactType, ArtifactStatus } from "@ainotes/core";
import { markdownToHtml } from "@/lib/jobs/html-generator";
import type { UUID } from "@ainotes/core";

const notesRepo = createNotesRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: noteId } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    // Verify ownership
    const note = await notesRepo.findById(noteId as UUID, userId);
    if (!note) return apiError(ApiErrorCode.NOT_FOUND);

    const body = await request.json();
    const { content } = body;

    if (typeof content !== "string") {
      return apiError(
        ApiErrorCode.VALIDATION_ERROR,
        "Content must be a string",
      );
    }

    // 1. Update MARKDOWN_SUMMARY artifact
    let markdownArtifact = await artifactsRepo.findByNoteAndType(
      noteId as UUID,
      ArtifactType.MARKDOWN_SUMMARY,
    );

    if (markdownArtifact) {
      await artifactsRepo.update(markdownArtifact.id, {
        storagePath: content,
        status: ArtifactStatus.READY,
      });
    } else {
      // If it doesn't exist (e.g. older note), create it
      // We need a dummy jobId or similar if strict constraints exist,
      // but artifactsRepo.create requires jobId.
      // Let's assume for now we only edit existing summaries or
      // check if we can skip jobId or use a generic one if allowed by DB.
      // Looking at `artifacts.repo.ts`, create requires jobId.
      // If no summary exists, maybe we shouldn't be editing it via this endpoint?
      // Or we should find the latest job?
      // For now, let's look for any job for this note or just error if no artifact.
      // Ideally, the UI only allows editing if summary exists.
      return apiError(ApiErrorCode.NOT_FOUND, "Summary artifact not found");
    }

    // 2. Refresh HTML_SUMMARY
    const html = await markdownToHtml(content);
    const htmlArtifact = await artifactsRepo.findByNoteAndType(
      noteId as UUID,
      ArtifactType.HTML_SUMMARY,
    );

    if (htmlArtifact) {
      await artifactsRepo.update(htmlArtifact.id, {
        storagePath: html,
        status: ArtifactStatus.READY,
      });
    } else {
      // Create if missing but markdown existed?
      // Can't create without jobId easily here.
      // Reuse markdown artifact's jobId
      await artifactsRepo.create({
        noteId: noteId as UUID,
        jobId: markdownArtifact.jobId,
        type: ArtifactType.HTML_SUMMARY,
      });
      // Then update content (since create returns domain object, we might need to update immediately or change repo to accept content on create)
      // Repo create doesn't take content.
      // So fetch again or just use the created one.
      const newHtmlArtifact = await artifactsRepo.findByNoteAndType(
        noteId as UUID,
        ArtifactType.HTML_SUMMARY,
      );
      if (newHtmlArtifact) {
        await artifactsRepo.update(newHtmlArtifact.id, {
          storagePath: html,
          status: ArtifactStatus.READY,
        });
      }
    }

    // 3. Invalidate PDF and DOCX
    // deleteByNoteAndType is available in artifactsRepo
    await artifactsRepo.deleteByNoteAndType(noteId as UUID, ArtifactType.PDF);
    await artifactsRepo.deleteByNoteAndType(noteId as UUID, ArtifactType.DOCX);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("PATCH /api/notes/:id/artifacts error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
