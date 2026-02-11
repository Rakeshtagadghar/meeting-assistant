import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UUID } from "@ainotes/core";
import { prisma, createMeetingSessionsRepository } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const sessionsRepo = createMeetingSessionsRepository(prisma);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const { sessionId } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const existing = await sessionsRepo.findById(sessionId as UUID);
    if (!existing) return apiError(ApiErrorCode.NOT_FOUND);
    if (existing.userId !== userId) return apiError(ApiErrorCode.FORBIDDEN);

    const body = (await request.json()) as Record<string, unknown>;

    const consentText = (body["consentText"] as string | null) ?? null;
    const title =
      body["title"] !== undefined ? (body["title"] as string) : undefined;
    const participants =
      body["participants"] !== undefined
        ? (body["participants"] as string[])
        : undefined;

    const session = await sessionsRepo.confirmConsent(
      sessionId as UUID,
      consentText,
      title,
      participants,
    );

    return NextResponse.json({ session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return apiError(ApiErrorCode.NOT_FOUND);
    }
    // eslint-disable-next-line no-console
    console.error("POST /api/meetings/:sessionId/consent error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
