import { z } from "zod";
import { NextResponse } from "next/server";
import { AI_MODELS } from "@ainotes/config/ai-models";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const requestSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default("audio/wav"),
  language: z.string().optional(),
});

interface ElevenLabsTranscribeResponse {
  text?: string;
  transcript?: string;
}

interface ElevenLabsErrorResponse {
  detail?: {
    code?: string;
    message?: string;
    status?: string;
  };
}

function normalizeLanguage(input?: string): string | undefined {
  if (!input || input === "auto") return undefined;
  return input;
}

function normalizeModelForSpeechToText(modelId: string): string {
  if (modelId === "scribe_v2_realtime") {
    return "scribe_v2";
  }
  return modelId;
}

function buildModelCandidates(configuredModelId: string): string[] {
  const candidates = [
    normalizeModelForSpeechToText(configuredModelId),
    "scribe_v2",
    "scribe_v1_experimental",
    "scribe_v1",
  ];
  return [...new Set(candidates)];
}

function isUnsupportedModelError(status: number, payloadText: string): boolean {
  if (status !== 400) return false;
  try {
    const payload = JSON.parse(payloadText) as ElevenLabsErrorResponse;
    const code = payload.detail?.code ?? "";
    const detailStatus = payload.detail?.status ?? "";
    return code === "unsupported_model" || detailStatus === "invalid_model_id";
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return apiError(
        ApiErrorCode.NOT_IMPLEMENTED,
        "ELEVENLABS_API_KEY is not configured",
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

    let buffer: Buffer;
    try {
      buffer = Buffer.from(audioBase64, "base64");
      if (!buffer.length) {
        return apiError(
          ApiErrorCode.VALIDATION_ERROR,
          "Audio payload is empty",
        );
      }
    } catch {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid base64 audio");
    }

    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    const formData = new FormData();
    const file = new File([arrayBuffer], "chunk.wav", { type: mimeType });
    const modelCandidates = buildModelCandidates(
      AI_MODELS.elevenlabs.realtimeStt,
    );
    const normalizedLanguage = normalizeLanguage(language);

    for (const modelId of modelCandidates) {
      formData.set("model_id", modelId);
      formData.set("file", file);
      if (normalizedLanguage) {
        formData.set("language_code", normalizedLanguage);
      }

      const response = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
          },
          body: formData,
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const message = await response.text();
        if (isUnsupportedModelError(response.status, message)) {
          continue;
        }
        return apiError(
          ApiErrorCode.INTERNAL_ERROR,
          `ElevenLabs transcription failed (${response.status}): ${message}`,
        );
      }

      const data = (await response.json()) as ElevenLabsTranscribeResponse;
      const text = (data.text ?? data.transcript ?? "").trim();

      return NextResponse.json({
        text,
        model: modelId,
      });
    }
    return apiError(
      ApiErrorCode.INTERNAL_ERROR,
      "ElevenLabs transcription failed: no supported model available",
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("POST /api/asr/elevenlabs/transcribe error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
