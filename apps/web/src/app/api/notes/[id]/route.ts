import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UpdateNoteInput, UUID, JsonValue } from "@ainotes/core";
import { validateUpdateNoteInput, normalizeTags } from "@ainotes/core";
import {
  prisma,
  createNotesRepository,
  createAISummariesRepository,
  createArtifactsRepository,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const notesRepo = createNotesRepository(prisma);
const summariesRepo = createAISummariesRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const note = await notesRepo.findById(id as UUID, userId);
    if (!note) return apiError(ApiErrorCode.NOT_FOUND);

    const summaries = await summariesRepo.findByNote(id as UUID);
    const artifacts = await artifactsRepo.findByNote(id as UUID);
    return NextResponse.json({ note, summaries, artifacts });
  } catch (error: unknown) {
    console.error("GET /api/notes/:id error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const body = (await request.json()) as Record<string, unknown>;

    const input: UpdateNoteInput = {
      ...(body["title"] !== undefined && { title: body["title"] as string }),
      ...(body["contentRich"] !== undefined && {
        contentRich: body["contentRich"] as JsonValue,
      }),
      ...(body["contentPlain"] !== undefined && {
        contentPlain: body["contentPlain"] as string,
      }),
      ...(body["tags"] !== undefined && {
        tags: normalizeTags(body["tags"] as string[]),
      }),
      ...(body["pinned"] !== undefined && {
        pinned: body["pinned"] as boolean,
      }),
      ...(body["folderId"] !== undefined && {
        folderId: body["folderId"] ? (body["folderId"] as UUID) : null,
      }),
    };

    const validation = validateUpdateNoteInput(input);
    if (!validation.valid) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, validation.errors);
    }

    await notesRepo.update(id as UUID, userId, input);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return apiError(ApiErrorCode.NOT_FOUND);
    }
    console.error("PATCH /api/notes/:id error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    await notesRepo.softDelete(id as UUID, userId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return apiError(ApiErrorCode.NOT_FOUND);
    }
    console.error("DELETE /api/notes/:id error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
