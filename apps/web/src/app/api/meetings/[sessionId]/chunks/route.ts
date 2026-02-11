import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CreateTranscriptChunkInput, UUID } from "@ainotes/core";
import { validateCreateTranscriptChunkInput } from "@ainotes/core";
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
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const { sessionId } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const session = await sessionsRepo.findById(sessionId as UUID);
    if (!session) return apiError(ApiErrorCode.NOT_FOUND);
    if (session.userId !== userId) return apiError(ApiErrorCode.FORBIDDEN);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : undefined;
    const afterSequence = searchParams.get("afterSequence")
      ? Number(searchParams.get("afterSequence"))
      : undefined;

    const chunks = await chunksRepo.findBySessionId(sessionId as UUID, {
      limit,
      afterSequence,
    });

    return NextResponse.json({ chunks });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("GET /api/meetings/:sessionId/chunks error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const { sessionId } = await params;
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const session = await sessionsRepo.findById(sessionId as UUID);
    if (!session) return apiError(ApiErrorCode.NOT_FOUND);
    if (session.userId !== userId) return apiError(ApiErrorCode.FORBIDDEN);

    const body = (await request.json()) as Record<string, unknown>;
    const rawChunks = body["chunks"] as Array<Record<string, unknown>>;

    if (!Array.isArray(rawChunks) || rawChunks.length === 0) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, [
        "chunks must be a non-empty array",
      ]);
    }

    // Validate each chunk
    const allErrors: string[] = [];
    const inputs: CreateTranscriptChunkInput[] = rawChunks.map((c, i) => {
      const input: CreateTranscriptChunkInput = {
        meetingSessionId: sessionId as UUID,
        sequence: (c["sequence"] as number) ?? 0,
        tStartMs: (c["tStartMs"] as number) ?? 0,
        tEndMs: (c["tEndMs"] as number) ?? 0,
        speaker: (c["speaker"] as string | null) ?? null,
        text: (c["text"] as string) ?? "",
        confidence: (c["confidence"] as number | null) ?? null,
      };

      const v = validateCreateTranscriptChunkInput(input);
      if (!v.valid) {
        allErrors.push(...v.errors.map((e) => `chunks[${String(i)}]: ${e}`));
      }

      return input;
    });

    if (allErrors.length > 0) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, allErrors);
    }

    const count = await chunksRepo.createMany(
      inputs.map((c) => ({
        meetingSessionId: c.meetingSessionId,
        sequence: c.sequence,
        tStartMs: c.tStartMs,
        tEndMs: c.tEndMs,
        speaker: c.speaker,
        text: c.text,
        confidence: c.confidence,
      })),
    );

    return NextResponse.json({ saved: count }, { status: 201 });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("POST /api/meetings/:sessionId/chunks error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
