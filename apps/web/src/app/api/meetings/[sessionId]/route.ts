import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UUID, MeetingSessionStatus } from "@ainotes/core";
import {
  prisma,
  createMeetingSessionsRepository,
  createTranscriptChunksRepository,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const sessionsRepo = createMeetingSessionsRepository(prisma);
const chunksRepo = createTranscriptChunksRepository(prisma);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const { sessionId } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const session = await sessionsRepo.findById(sessionId as UUID);
    if (!session) return apiError(ApiErrorCode.NOT_FOUND);
    if (session.userId !== userId) return apiError(ApiErrorCode.FORBIDDEN);

    const chunks = await chunksRepo.findBySessionId(sessionId as UUID);
    return NextResponse.json({ session, chunks });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("GET /api/meetings/:sessionId error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function PATCH(
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

    const updateData: Partial<{
      status: MeetingSessionStatus;
      title: string;
      participants: string[];
    }> = {};

    if (body["status"] !== undefined) {
      updateData.status = body["status"] as MeetingSessionStatus;
    }
    if (body["title"] !== undefined) {
      updateData.title = body["title"] as string;
    }
    if (body["participants"] !== undefined) {
      updateData.participants = body["participants"] as string[];
    }

    const session = await sessionsRepo.update(sessionId as UUID, updateData);
    return NextResponse.json({ session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return apiError(ApiErrorCode.NOT_FOUND);
    }
    // eslint-disable-next-line no-console
    console.error("PATCH /api/meetings/:sessionId error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
