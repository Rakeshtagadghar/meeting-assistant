import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UUID, ISODateString } from "@ainotes/core";
import { canAccessShareLink } from "@ainotes/core";
import {
  prisma,
  createNotesRepository,
  createShareLinksRepository,
  createAISummariesRepository,
} from "@/lib/db";
import { apiError, ApiErrorCode } from "@/lib/api";

const notesRepo = createNotesRepository(prisma);
const shareRepo = createShareLinksRepository(prisma);
const summariesRepo = createAISummariesRepository(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await params;

    const link = await shareRepo.findByToken(token);
    if (!link) return apiError(ApiErrorCode.NOT_FOUND);

    // Check email-based access if provided
    const viewerEmail = request.headers.get("x-viewer-email");
    if (viewerEmail) {
      const access = canAccessShareLink(
        link,
        viewerEmail,
        new Date().toISOString() as ISODateString,
      );
      if (!access.allowed) {
        return apiError(ApiErrorCode.FORBIDDEN, access.reason);
      }
    } else if (link.visibility === "RESTRICTED") {
      return apiError(
        ApiErrorCode.FORBIDDEN,
        "Email required for restricted links",
      );
    }

    // Use the link owner's userId to fetch the note
    const note = await notesRepo.findById(
      link.noteId,
      link.createdByUserId as UUID,
    );
    if (!note) return apiError(ApiErrorCode.NOT_FOUND);

    const summaries = await summariesRepo.findByNote(link.noteId);
    return NextResponse.json({ noteReadOnly: note, summaries });
  } catch (error: unknown) {
    console.error("GET /api/shared/:token error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
