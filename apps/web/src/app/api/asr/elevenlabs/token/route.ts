import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

interface ElevenLabsTokenResponse {
  token?: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return apiError(ApiErrorCode.UNAUTHORIZED);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return apiError(
        ApiErrorCode.NOT_IMPLEMENTED,
        "ELEVENLABS_API_KEY is not configured",
      );
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const message = await response.text();
      return apiError(
        ApiErrorCode.INTERNAL_ERROR,
        `ElevenLabs token request failed (${response.status}): ${message}`,
      );
    }

    const data = (await response.json()) as ElevenLabsTokenResponse;
    if (!data.token) {
      return apiError(
        ApiErrorCode.INTERNAL_ERROR,
        "ElevenLabs did not return a token",
      );
    }

    return NextResponse.json({ token: data.token });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("GET /api/asr/elevenlabs/token error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
