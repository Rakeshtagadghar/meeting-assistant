import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IntegrationProvider } from "@ainotes/core";
import { prisma, createUserIntegrationsRepository } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

const integrationsRepo = createUserIntegrationsRepository(prisma);
const providers = Object.values(IntegrationProvider);

function isIntegrationProvider(
  value: unknown,
): value is (typeof providers)[number] {
  return (
    typeof value === "string" &&
    providers.includes(value as (typeof providers)[number])
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const integrations = await integrationsRepo.findByUser(userId);

    return NextResponse.json({
      integrations: integrations.map((integration) => ({
        provider: integration.provider,
        expiresAt: integration.expiresAt,
        metadataJson: integration.metadataJson,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      })),
    });
  } catch (error: unknown) {
    console.error("GET /api/integrations error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const body = (await request.json()) as Record<string, unknown>;
    const provider = body["provider"];

    if (!isIntegrationProvider(provider)) {
      return apiError(
        ApiErrorCode.VALIDATION_ERROR,
        `provider must be one of: ${providers.join(", ")}`,
      );
    }

    await integrationsRepo.deleteByUserAndProvider(userId, provider);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("DELETE /api/integrations error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
