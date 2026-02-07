import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CreateNoteInput, JsonValue, UUID } from "@ainotes/core";
import { validateCreateNoteInput, normalizeTags } from "@ainotes/core";
import { prisma, createNotesRepository } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const notesRepo = createNotesRepository(prisma);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const body = (await request.json()) as Record<string, unknown>;

    const input: CreateNoteInput = {
      title: (body["title"] as string) ?? "",
      contentRich: (body["contentRich"] as JsonValue) ?? ({} as JsonValue),
      contentPlain: (body["contentPlain"] as string) ?? "",
      type: (body["type"] as "FREEFORM" | "MEETING") ?? "FREEFORM",
      tags: normalizeTags(
        Array.isArray(body["tags"]) ? (body["tags"] as string[]) : [],
      ),
      ...(body["folderId"] !== undefined && {
        folderId: body["folderId"] ? (body["folderId"] as UUID) : null,
      }),
    };

    const validation = validateCreateNoteInput(input);
    if (!validation.valid) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, validation.errors);
    }

    const note = await notesRepo.create(userId, input);
    return NextResponse.json({ noteId: note.id }, { status: 201 });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("POST /api/notes error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const tag = searchParams.get("tag") ?? undefined;
    const pinnedParam = searchParams.get("pinned");
    const pinned =
      pinnedParam === "true"
        ? true
        : pinnedParam === "false"
          ? false
          : undefined;

    const notes = await notesRepo.findByUser(userId, { q, tag, pinned });
    return NextResponse.json({ notes });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("GET /api/notes error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
