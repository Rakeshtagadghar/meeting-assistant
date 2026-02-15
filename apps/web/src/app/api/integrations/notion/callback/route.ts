import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IntegrationProvider, type ISODateString } from "@ainotes/core";
import { prisma, createUserIntegrationsRepository } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";
import {
  exchangeNotionCodeForToken,
  getNotionCallbackRedirect,
} from "@/lib/integrations/notion";
import { encryptSecret } from "@/lib/integrations/crypto";

const integrationsRepo = createUserIntegrationsRepository(prisma);

function toReasonToken(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 64);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const params = request.nextUrl.searchParams;
    const oauthError = params.get("error");
    const oauthCode = params.get("code");
    const oauthState = params.get("state");

    if (oauthError) {
      return NextResponse.redirect(
        getNotionCallbackRedirect(
          request,
          "error",
          `oauth_${toReasonToken(oauthError)}`,
        ),
      );
    }

    if (!oauthCode || !oauthState) {
      return NextResponse.redirect(
        getNotionCallbackRedirect(request, "error", "missing_code_or_state"),
      );
    }

    const stateData = verifyOAuthState(oauthState);
    if (stateData.userId !== userId) {
      return apiError(ApiErrorCode.FORBIDDEN);
    }

    const tokenResponse = await exchangeNotionCodeForToken(request, oauthCode);

    const expiresAt = tokenResponse.expires_in
      ? (new Date(
          Date.now() + tokenResponse.expires_in * 1000,
        ).toISOString() as ISODateString)
      : null;

    await integrationsRepo.upsert({
      userId,
      provider: IntegrationProvider.NOTION,
      accessToken: encryptSecret(tokenResponse.access_token),
      refreshToken: tokenResponse.refresh_token
        ? encryptSecret(tokenResponse.refresh_token)
        : null,
      expiresAt,
      metadataJson: {
        workspace_id: tokenResponse.workspace_id ?? null,
        workspace_name: tokenResponse.workspace_name ?? null,
        workspace_icon: tokenResponse.workspace_icon ?? null,
        bot_id: tokenResponse.bot_id ?? null,
        duplicated_template_id: tokenResponse.duplicated_template_id ?? null,
      },
    });

    return NextResponse.redirect(
      getNotionCallbackRedirect(request, "connected"),
    );
  } catch (error: unknown) {
    console.error("GET /api/integrations/notion/callback error:", error);
    return NextResponse.redirect(
      getNotionCallbackRedirect(request, "error", "token_exchange_failed"),
    );
  }
}
