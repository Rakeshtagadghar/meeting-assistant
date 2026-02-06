import type { UUID } from "@ainotes/core";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Phase 3 placeholder: extracts userId from x-user-id header.
 * Phase 4 will replace this with NextAuth session lookup.
 *
 * SECURITY: Gated to non-production environments only.
 */
export function getAuthUserId(request: Request): UUID | null {
  if (process.env["NODE_ENV"] === "production") {
    // In production, use real auth (Phase 4 — NextAuth)
    return null;
  }

  const headerValue = request.headers.get("x-user-id");
  if (!headerValue) return null;
  if (!UUID_REGEX.test(headerValue)) return null;

  return headerValue as UUID;
}
