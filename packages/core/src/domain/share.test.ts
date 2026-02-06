import { describe, it, expect } from "vitest";
import type { ShareLink, UUID, ISODateString } from "./types";
import {
  canAccessShareLink,
  isShareLinkExpired,
  isShareLinkOwner,
  createShareLink,
  normalizeEmail,
} from "./share";

// ─── Test fixture factory ───

function makeShareLink(overrides?: Partial<ShareLink>): ShareLink {
  return {
    id: "aaa00000-0000-0000-0000-000000000001" as UUID,
    noteId: "bbb00000-0000-0000-0000-000000000001" as UUID,
    createdByUserId: "ccc00000-0000-0000-0000-000000000001" as UUID,
    visibility: "RESTRICTED",
    allowedEmails: ["alice@example.com", "bob@example.com"],
    token: "tok_abc123",
    expiresAt: null,
    createdAt: "2025-01-01T00:00:00.000Z" as ISODateString,
    ...overrides,
  };
}

const NOW = "2025-06-15T12:00:00.000Z" as ISODateString;
const PAST = "2025-01-01T00:00:00.000Z" as ISODateString;
const FUTURE = "2026-01-01T00:00:00.000Z" as ISODateString;

// ─── canAccessShareLink ───

describe("canAccessShareLink", () => {
  it("denies access when visibility is PRIVATE", () => {
    const link = makeShareLink({ visibility: "PRIVATE" });
    const result = canAccessShareLink(link, "alice@example.com", NOW);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private");
  });

  it("denies access when share link is expired", () => {
    const link = makeShareLink({ expiresAt: PAST });
    const result = canAccessShareLink(link, "alice@example.com", NOW);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("allows access when email is in allowedEmails (RESTRICTED)", () => {
    const link = makeShareLink();
    const result = canAccessShareLink(link, "alice@example.com", NOW);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("email_allowed");
  });

  it("denies access when email is NOT in allowedEmails (RESTRICTED)", () => {
    const link = makeShareLink();
    const result = canAccessShareLink(link, "eve@example.com", NOW);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("email_not_allowed");
  });

  it("email comparison is case-insensitive", () => {
    const link = makeShareLink();
    const result = canAccessShareLink(link, "ALICE@EXAMPLE.COM", NOW);

    expect(result.allowed).toBe(true);
  });

  it("email comparison trims whitespace", () => {
    const link = makeShareLink();
    const result = canAccessShareLink(link, "  alice@example.com  ", NOW);

    expect(result.allowed).toBe(true);
  });

  it("allows access when link has no expiration and email matches", () => {
    const link = makeShareLink({ expiresAt: null });
    const result = canAccessShareLink(link, "bob@example.com", NOW);

    expect(result.allowed).toBe(true);
  });
});

// ─── isShareLinkExpired ───

describe("isShareLinkExpired", () => {
  it("returns false when expiresAt is null", () => {
    const link = makeShareLink({ expiresAt: null });
    expect(isShareLinkExpired(link, NOW)).toBe(false);
  });

  it("returns false when expiresAt is in the future", () => {
    const link = makeShareLink({ expiresAt: FUTURE });
    expect(isShareLinkExpired(link, NOW)).toBe(false);
  });

  it("returns true when expiresAt is in the past", () => {
    const link = makeShareLink({ expiresAt: PAST });
    expect(isShareLinkExpired(link, NOW)).toBe(true);
  });

  it("returns true when expiresAt equals now (edge case)", () => {
    const link = makeShareLink({ expiresAt: NOW });
    expect(isShareLinkExpired(link, NOW)).toBe(true);
  });
});

// ─── isShareLinkOwner ───

describe("isShareLinkOwner", () => {
  it("returns true when userId matches createdByUserId", () => {
    const link = makeShareLink();
    expect(isShareLinkOwner(link, link.createdByUserId)).toBe(true);
  });

  it("returns false when userId does not match", () => {
    const link = makeShareLink();
    const otherId = "ddd00000-0000-0000-0000-000000000099" as UUID;
    expect(isShareLinkOwner(link, otherId)).toBe(false);
  });
});

// ─── createShareLink ───

describe("createShareLink", () => {
  it("creates a share link with all fields populated", () => {
    const link = createShareLink(
      {
        noteId: "bbb00000-0000-0000-0000-000000000001" as UUID,
        createdByUserId: "ccc00000-0000-0000-0000-000000000001" as UUID,
        visibility: "RESTRICTED",
        allowedEmails: ["test@example.com"],
        expiresAt: null,
      },
      "aaa00000-0000-0000-0000-000000000001" as UUID,
      "tok_xyz",
      NOW,
    );

    expect(link.id).toBe("aaa00000-0000-0000-0000-000000000001");
    expect(link.token).toBe("tok_xyz");
    expect(link.visibility).toBe("RESTRICTED");
    expect(link.createdAt).toBe(NOW);
  });

  it("normalizes allowedEmails (lowercase, trimmed)", () => {
    const link = createShareLink(
      {
        noteId: "bbb00000-0000-0000-0000-000000000001" as UUID,
        createdByUserId: "ccc00000-0000-0000-0000-000000000001" as UUID,
        visibility: "RESTRICTED",
        allowedEmails: [" Alice@Example.COM ", "BOB@test.com"],
        expiresAt: null,
      },
      "aaa00000-0000-0000-0000-000000000001" as UUID,
      "tok_xyz",
      NOW,
    );

    expect(link.allowedEmails).toEqual(["alice@example.com", "bob@test.com"]);
  });

  it("preserves expiresAt", () => {
    const link = createShareLink(
      {
        noteId: "bbb00000-0000-0000-0000-000000000001" as UUID,
        createdByUserId: "ccc00000-0000-0000-0000-000000000001" as UUID,
        visibility: "RESTRICTED",
        allowedEmails: [],
        expiresAt: FUTURE,
      },
      "aaa00000-0000-0000-0000-000000000001" as UUID,
      "tok_xyz",
      NOW,
    );

    expect(link.expiresAt).toBe(FUTURE);
  });
});

// ─── normalizeEmail ───

describe("normalizeEmail", () => {
  it("lowercases email", () => {
    expect(normalizeEmail("ALICE@EXAMPLE.COM")).toBe("alice@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  alice@example.com  ")).toBe("alice@example.com");
  });

  it("handles already-normalized email", () => {
    expect(normalizeEmail("alice@example.com")).toBe("alice@example.com");
  });
});
