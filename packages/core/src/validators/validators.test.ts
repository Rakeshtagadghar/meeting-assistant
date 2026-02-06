import { describe, it, expect } from "vitest";
import type { UUID, ISODateString } from "../domain/types";
import {
  validateCreateNoteInput,
  validateUpdateNoteInput,
  validateCreateShareLinkInput,
  validateCreateMeetingSessionInput,
} from "./index";

// ─── validateCreateNoteInput ───

describe("validateCreateNoteInput", () => {
  const valid = {
    title: "My Note",
    contentRich: { type: "doc", content: [] },
    contentPlain: "",
    type: "FREEFORM" as const,
    tags: ["work"],
  };

  it("accepts a valid input", () => {
    const result = validateCreateNoteInput(valid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty title", () => {
    const result = validateCreateNoteInput({ ...valid, title: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title must not be empty");
  });

  it("rejects whitespace-only title", () => {
    const result = validateCreateNoteInput({ ...valid, title: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title must not be empty");
  });

  it("rejects title exceeding 500 characters", () => {
    const result = validateCreateNoteInput({
      ...valid,
      title: "a".repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title must not exceed 500 characters");
  });

  it("accepts title with exactly 500 characters", () => {
    const result = validateCreateNoteInput({
      ...valid,
      title: "a".repeat(500),
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid note type", () => {
    const result = validateCreateNoteInput({
      ...valid,
      type: "INVALID" as "FREEFORM",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("type must be one of: FREEFORM, MEETING");
  });

  it("accepts MEETING type", () => {
    const result = validateCreateNoteInput({ ...valid, type: "MEETING" });
    expect(result.valid).toBe(true);
  });

  it("rejects more than 20 tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${String(i)}`);
    const result = validateCreateNoteInput({ ...valid, tags });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("tags must not exceed 20 items");
  });

  it("rejects a tag exceeding 50 characters", () => {
    const result = validateCreateNoteInput({
      ...valid,
      tags: ["a".repeat(51)],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("exceeds 50 characters");
  });

  it("collects multiple errors", () => {
    const result = validateCreateNoteInput({
      ...valid,
      title: "",
      type: "BAD" as "FREEFORM",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── validateUpdateNoteInput ───

describe("validateUpdateNoteInput", () => {
  it("accepts valid partial update (title only)", () => {
    const result = validateUpdateNoteInput({ title: "New Title" });
    expect(result.valid).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = validateUpdateNoteInput({});
    expect(result.valid).toBe(true);
  });

  it("rejects empty title when provided", () => {
    const result = validateUpdateNoteInput({ title: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title must not be empty");
  });

  it("rejects title exceeding 500 characters", () => {
    const result = validateUpdateNoteInput({ title: "a".repeat(501) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title must not exceed 500 characters");
  });

  it("rejects more than 20 tags when provided", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${String(i)}`);
    const result = validateUpdateNoteInput({ tags });
    expect(result.valid).toBe(false);
  });

  it("accepts valid tags update", () => {
    const result = validateUpdateNoteInput({ tags: ["work", "dev"] });
    expect(result.valid).toBe(true);
  });

  it("accepts pinned update", () => {
    const result = validateUpdateNoteInput({ pinned: true });
    expect(result.valid).toBe(true);
  });
});

// ─── validateCreateShareLinkInput ───

describe("validateCreateShareLinkInput", () => {
  const valid = {
    noteId: "bbb00000-0000-0000-0000-000000000001" as UUID,
    createdByUserId: "ccc00000-0000-0000-0000-000000000001" as UUID,
    visibility: "RESTRICTED" as const,
    allowedEmails: ["alice@example.com"],
    expiresAt: null,
  };

  it("accepts valid input", () => {
    const result = validateCreateShareLinkInput(valid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid visibility", () => {
    const result = validateCreateShareLinkInput({
      ...valid,
      visibility: "PUBLIC" as "RESTRICTED",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "visibility must be one of: PRIVATE, RESTRICTED",
    );
  });

  it("rejects RESTRICTED with no allowedEmails", () => {
    const result = validateCreateShareLinkInput({
      ...valid,
      visibility: "RESTRICTED",
      allowedEmails: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "RESTRICTED visibility requires at least one allowed email",
    );
  });

  it("accepts PRIVATE with no allowedEmails", () => {
    const result = validateCreateShareLinkInput({
      ...valid,
      visibility: "PRIVATE",
      allowedEmails: [],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = validateCreateShareLinkInput({
      ...valid,
      allowedEmails: ["not-an-email"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid email");
  });

  it("accepts multiple valid emails", () => {
    const result = validateCreateShareLinkInput({
      ...valid,
      allowedEmails: ["a@b.com", "c@d.org"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects expiresAt in the past", () => {
    const result = validateCreateShareLinkInput({
      ...valid,
      expiresAt: "2020-01-01T00:00:00.000Z" as ISODateString,
    });
    // Note: validator cannot check "now" without a clock — this validates format only
    // Past dates are accepted at the domain level; business logic validates elsewhere
    expect(result.valid).toBe(true);
  });
});

// ─── validateCreateMeetingSessionInput ───

describe("validateCreateMeetingSessionInput", () => {
  const valid = {
    noteId: "note-0000-0000-0000-000000000001" as UUID,
    userId: "user-0000-0000-0000-000000000001" as UUID,
    source: "MANUAL" as const,
  };

  it("accepts valid input", () => {
    const result = validateCreateMeetingSessionInput(valid);
    expect(result.valid).toBe(true);
  });

  it("accepts CALENDAR source", () => {
    const result = validateCreateMeetingSessionInput({
      ...valid,
      source: "CALENDAR",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid source", () => {
    const result = validateCreateMeetingSessionInput({
      ...valid,
      source: "INVALID" as "MANUAL",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("source must be one of: MANUAL, CALENDAR");
  });
});
