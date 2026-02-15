import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IntegrationProvider, type UUID } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { exportSummaryWithConnector } from "@/lib/integrations";

const providers = Object.values(IntegrationProvider);

function isIntegrationProvider(
  value: unknown,
): value is (typeof providers)[number] {
  return (
    typeof value === "string" &&
    providers.includes(value as (typeof providers)[number])
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const body = (await request.json()) as Record<string, unknown>;
    const noteId = body["noteId"];
    const provider = body["provider"];

    if (typeof noteId !== "string" || noteId.length === 0) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "noteId is required");
    }

    if (!isIntegrationProvider(provider)) {
      return apiError(
        ApiErrorCode.VALIDATION_ERROR,
        `provider must be one of: ${providers.join(", ")}`,
      );
    }

    const result = await exportSummaryWithConnector(
      provider,
      noteId as UUID,
      userId,
    );
    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 409,
    });
  } catch (error: unknown) {
    console.error("POST /api/integrations/export error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
