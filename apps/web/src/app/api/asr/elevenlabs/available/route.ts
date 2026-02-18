import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const hasKey = Boolean(process.env.ELEVENLABS_API_KEY);
  return NextResponse.json(
    {
      available: hasKey,
      reason: hasKey ? "ok" : "missing_elevenlabs_api_key",
    },
    { status: 200 },
  );
}
