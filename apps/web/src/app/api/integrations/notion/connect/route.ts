import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createOAuthState } from "@/lib/integrations/oauth-state";
import { buildNotionAuthorizeUrl } from "@/lib/integrations/notion";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const state = createOAuthState(userId);
    const url = buildNotionAuthorizeUrl(request, state);

    return NextResponse.redirect(url);
  } catch (error: unknown) {
    console.error("GET /api/integrations/notion/connect error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
