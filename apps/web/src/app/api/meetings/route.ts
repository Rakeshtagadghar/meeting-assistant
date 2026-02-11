import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  CreateMeetingSessionInput,
  MeetingSessionSource,
  MeetingPlatform,
  UUID,
} from "@ainotes/core";
import { validateCreateMeetingSessionInput } from "@ainotes/core";
import { prisma, createMeetingSessionsRepository } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const sessionsRepo = createMeetingSessionsRepository(prisma);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const body = (await request.json()) as Record<string, unknown>;

    const input: CreateMeetingSessionInput = {
      noteId: (body["noteId"] as string as UUID) ?? ("" as UUID),
      userId,
      source: ((body["source"] as string) ?? "MANUAL") as MeetingSessionSource,
      ...(body["platform"] !== undefined && {
        platform: body["platform"] as MeetingPlatform,
      }),
      ...(body["title"] !== undefined && {
        title: body["title"] as string,
      }),
      ...(body["participants"] !== undefined && {
        participants: body["participants"] as readonly string[],
      }),
    };

    const validation = validateCreateMeetingSessionInput(input);
    if (!validation.valid) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, validation.errors);
    }

    const session = await sessionsRepo.create({
      userId,
      noteId: input.noteId,
      source: input.source,
      platform: input.platform,
      title: input.title,
      participants: input.participants ? [...input.participants] : undefined,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("POST /api/meetings error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
