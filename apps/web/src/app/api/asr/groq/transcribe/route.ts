import { z } from "zod";
import { NextResponse } from "next/server";
import { getGroqClient } from "@ainotes/ai";
import { AI_MODELS } from "@ainotes/config/ai-models";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const GROQ_MAX_REQUESTS_PER_MINUTE = 20;
const GROQ_RATE_LIMIT_WINDOW_MS = 60_000;
const userRequestWindows = new Map<string, number[]>();

const requestSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default("audio/wav"),
  language: z.string().optional(),
});

function normalizeLanguage(input?: string): string | undefined {
  if (!input || input === "auto") return undefined;
  return input;
}

function tryConsumeRateLimitSlot(userId: string, nowMs: number): boolean {
  const existingWindow = userRequestWindows.get(userId) ?? [];
  const activeWindow = existingWindow.filter(
    (timestampMs) => nowMs - timestampMs < GROQ_RATE_LIMIT_WINDOW_MS,
  );

  if (activeWindow.length >= GROQ_MAX_REQUESTS_PER_MINUTE) {
    userRequestWindows.set(userId, activeWindow);
    return false;
  }

  activeWindow.push(nowMs);
  userRequestWindows.set(userId, activeWindow);
  return true;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);
    if (!tryConsumeRateLimitSlot(userId, Date.now())) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message:
              "Groq realtime transcription is limited to 20 requests/min",
          },
        },
        { status: 429 },
      );
    }

    const raw = (await request.json()) as unknown;
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(
        ApiErrorCode.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message),
      );
    }

    const { audioBase64, mimeType, language } = parsed.data;

    let bytes: Uint8Array;
    try {
      const buffer = Buffer.from(audioBase64, "base64");
      if (!buffer.length) {
        return apiError(
          ApiErrorCode.VALIDATION_ERROR,
          "Audio payload is empty",
        );
      }
      bytes = new Uint8Array(buffer);
    } catch {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid base64 audio");
    }

    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const file = new File([arrayBuffer], "chunk.wav", { type: mimeType });
    const client = getGroqClient();
    const transcription = await client.audio.transcriptions.create({
      model: AI_MODELS.groq.realtimeTranscription,
      file,
      language: normalizeLanguage(language),
      response_format: "json",
      temperature: 0,
    });

    return NextResponse.json({
      text: transcription.text?.trim() ?? "",
      model: AI_MODELS.groq.realtimeTranscription,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("POST /api/asr/groq/transcribe error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
