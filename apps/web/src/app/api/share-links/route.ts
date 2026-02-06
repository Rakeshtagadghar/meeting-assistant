import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CreateShareLinkInput, UUID, ISODateString } from "@ainotes/core";
import { validateCreateShareLinkInput } from "@ainotes/core";
import { prisma, createShareLinksRepository } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const shareRepo = createShareLinksRepository(prisma);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = getAuthUserId(request);
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const body = (await request.json()) as Record<string, unknown>;

    const input: CreateShareLinkInput = {
      noteId: body["noteId"] as string as UUID,
      createdByUserId: userId,
      visibility:
        (body["visibility"] as "PRIVATE" | "RESTRICTED") ?? "RESTRICTED",
      allowedEmails: Array.isArray(body["allowedEmails"])
        ? (body["allowedEmails"] as string[])
        : [],
      expiresAt: (body["expiresAt"] as string as ISODateString) ?? null,
    };

    const validation = validateCreateShareLinkInput(input);
    if (!validation.valid) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, validation.errors);
    }

    const token = crypto.randomUUID();
    const link = await shareRepo.create(input, token);
    return NextResponse.json({ token: link.token }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/share-links error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
