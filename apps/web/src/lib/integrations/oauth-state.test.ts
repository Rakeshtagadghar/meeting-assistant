import { afterEach, describe, expect, it, vi } from "vitest";
import type { UUID } from "@ainotes/core";
import { createOAuthState, verifyOAuthState } from "./oauth-state";

const originalStateSecret = process.env["INTEGRATIONS_OAUTH_STATE_SECRET"];
const originalNextAuthSecret = process.env["NEXTAUTH_SECRET"];

afterEach(() => {
  vi.useRealTimers();

  if (originalStateSecret === undefined) {
    delete process.env["INTEGRATIONS_OAUTH_STATE_SECRET"];
  } else {
    process.env["INTEGRATIONS_OAUTH_STATE_SECRET"] = originalStateSecret;
  }

  if (originalNextAuthSecret === undefined) {
    delete process.env["NEXTAUTH_SECRET"];
  } else {
    process.env["NEXTAUTH_SECRET"] = originalNextAuthSecret;
  }
});

describe("oauth state", () => {
  it("creates and verifies state for the same user", () => {
    process.env["INTEGRATIONS_OAUTH_STATE_SECRET"] = "state-secret";

    const userId = "11111111-1111-1111-1111-111111111111" as UUID;
    const state = createOAuthState(userId);

    const verified = verifyOAuthState(state);
    expect(verified.userId).toBe(userId);
  });

  it("rejects tampered state", () => {
    process.env["INTEGRATIONS_OAUTH_STATE_SECRET"] = "state-secret";

    const userId = "11111111-1111-1111-1111-111111111111" as UUID;
    const state = createOAuthState(userId);
    const [payload] = state.split(".");
    const tampered = `${payload}.bad-signature`;

    expect(() => verifyOAuthState(tampered)).toThrow(
      "OAuth state signature mismatch",
    );
  });

  it("rejects expired state", () => {
    process.env["INTEGRATIONS_OAUTH_STATE_SECRET"] = "state-secret";

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T00:00:00.000Z"));

    const userId = "11111111-1111-1111-1111-111111111111" as UUID;
    const state = createOAuthState(userId);

    vi.setSystemTime(new Date("2026-02-15T00:11:00.000Z"));

    expect(() => verifyOAuthState(state)).toThrow("OAuth state expired");
  });

  it("falls back to NEXTAUTH_SECRET", () => {
    delete process.env["INTEGRATIONS_OAUTH_STATE_SECRET"];
    process.env["NEXTAUTH_SECRET"] = "nextauth-secret";

    const userId = "11111111-1111-1111-1111-111111111111" as UUID;
    const state = createOAuthState(userId);

    const verified = verifyOAuthState(state);
    expect(verified.userId).toBe(userId);
  });
});
