import { describe, it, expect } from "vitest";
import type { Note, UUID, ISODateString } from "./types";
import {
  createNote,
  updateNote,
  softDeleteNote,
  restoreNote,
  serializeNote,
  normalizeTags,
  isValidTag,
  addTag,
  removeTag,
  pinNote,
  unpinNote,
  extractPlainText,
} from "./note";

// ─── Test fixture factory ───

function makeNote(overrides?: Partial<Note>): Note {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000" as UUID,
    userId: "660e8400-e29b-41d4-a716-446655440000" as UUID,
    title: "Test Note",
    contentRich: { type: "doc", content: [] },
    contentPlain: "",
    type: "FREEFORM",
    tags: [],
    pinned: false,
    folderId: null,
    createdAt: "2025-01-01T00:00:00.000Z" as ISODateString,
    updatedAt: "2025-01-01T00:00:00.000Z" as ISODateString,
    deletedAt: null,
    ...overrides,
  };
}

const NOW = "2025-06-15T12:00:00.000Z" as ISODateString;
const LATER = "2025-06-15T13:00:00.000Z" as ISODateString;

// ─── createNote ───

describe("createNote", () => {
  it("creates a note with all required fields", () => {
    const note = createNote(
      {
        title: "My Note",
        contentRich: { type: "doc", content: [{ type: "paragraph" }] },
        contentPlain: "Hello world",
        type: "FREEFORM",
        tags: ["work"],
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );

    expect(note.title).toBe("My Note");
    expect(note.contentPlain).toBe("Hello world");
    expect(note.type).toBe("FREEFORM");
  });

  it("sets createdAt and updatedAt to the provided now value", () => {
    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "MEETING",
        tags: [],
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );

    expect(note.createdAt).toBe(NOW);
    expect(note.updatedAt).toBe(NOW);
  });

  it("sets pinned to false by default", () => {
    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );

    expect(note.pinned).toBe(false);
  });

  it("sets deletedAt to null", () => {
    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );

    expect(note.deletedAt).toBeNull();
  });

  it("preserves the provided id and userId", () => {
    const id = "aaa00000-0000-0000-0000-000000000000" as UUID;
    const userId = "bbb00000-0000-0000-0000-000000000000" as UUID;

    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      },
      userId,
      id,
      NOW,
    );

    expect(note.id).toBe(id);
    expect(note.userId).toBe(userId);
  });

  it("normalizes tags on creation", () => {
    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "FREEFORM",
        tags: ["Work", " dev ", "WORK"],
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );

    expect(note.tags).toEqual(["work", "dev"]);
  });
});

// ─── updateNote ───

describe("updateNote", () => {
  it("updates title and bumps updatedAt", () => {
    const note = makeNote();
    const updated = updateNote(note, { title: "New Title" }, NOW);

    expect(updated.title).toBe("New Title");
    expect(updated.updatedAt).toBe(NOW);
  });

  it("updates contentRich and bumps updatedAt", () => {
    const note = makeNote();
    const newContent = { type: "doc", content: [{ type: "paragraph" }] };
    const updated = updateNote(note, { contentRich: newContent }, NOW);

    expect(updated.contentRich).toEqual(newContent);
    expect(updated.updatedAt).toBe(NOW);
  });

  it("applies partial update (only title, others unchanged)", () => {
    const note = makeNote({ title: "Old", pinned: true });
    const updated = updateNote(note, { title: "New" }, NOW);

    expect(updated.title).toBe("New");
    expect(updated.pinned).toBe(true);
    expect(updated.contentRich).toEqual(note.contentRich);
  });

  it("does not modify createdAt", () => {
    const note = makeNote();
    const updated = updateNote(note, { title: "X" }, NOW);

    expect(updated.createdAt).toBe(note.createdAt);
  });

  it("does not modify id or userId", () => {
    const note = makeNote();
    const updated = updateNote(note, { title: "X" }, NOW);

    expect(updated.id).toBe(note.id);
    expect(updated.userId).toBe(note.userId);
  });

  it("returns a new object (does not mutate original)", () => {
    const note = makeNote();
    const updated = updateNote(note, { title: "X" }, NOW);

    expect(updated).not.toBe(note);
    expect(note.title).toBe("Test Note");
  });
});

// ─── softDeleteNote / restoreNote ───

describe("softDeleteNote", () => {
  it("sets deletedAt to the provided now", () => {
    const note = makeNote();
    const deleted = softDeleteNote(note, NOW);

    expect(deleted.deletedAt).toBe(NOW);
  });

  it("updates an already deleted note's deletedAt", () => {
    const note = makeNote({
      deletedAt: "2025-01-01T00:00:00.000Z" as ISODateString,
    });
    const deleted = softDeleteNote(note, LATER);

    expect(deleted.deletedAt).toBe(LATER);
  });
});

describe("restoreNote", () => {
  it("clears deletedAt back to null", () => {
    const note = makeNote({ deletedAt: NOW });
    const restored = restoreNote(note);

    expect(restored.deletedAt).toBeNull();
  });
});

// ─── serializeNote ───

describe("serializeNote", () => {
  it("returns a plain object with all Note fields", () => {
    const note = makeNote({ title: "Serialize Test", tags: ["a", "b"] });
    const serialized = serializeNote(note);

    expect(serialized.title).toBe("Serialize Test");
    expect(serialized.tags).toEqual(["a", "b"]);
    expect(serialized.id).toBe(note.id);
  });

  it("round-trips through JSON.stringify/parse", () => {
    const note = makeNote({
      contentRich: { type: "doc", content: [{ type: "text", text: "hi" }] },
    });
    const serialized = serializeNote(note);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed["title"]).toBe(note.title);
    expect(parsed["contentRich"]).toEqual(note.contentRich);
  });

  it("has no undefined values", () => {
    const note = makeNote();
    const serialized = serializeNote(note);

    for (const value of Object.values(serialized)) {
      expect(value).not.toBeUndefined();
    }
  });
});

// ─── extractPlainText ───

describe("extractPlainText", () => {
  it("extracts text from TipTap-like doc structure", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }],
        },
      ],
    };
    const text = extractPlainText(content);
    expect(text).toContain("Hello world");
    expect(text).toContain("Second paragraph");
  });

  it("returns empty string for null content", () => {
    expect(extractPlainText(null)).toBe("");
  });

  it("returns empty string for empty doc", () => {
    expect(extractPlainText({ type: "doc", content: [] })).toBe("");
  });
});

// ─── normalizeTags ───

describe("normalizeTags", () => {
  it("converts tags to lowercase", () => {
    expect(normalizeTags(["Work", "PLAY"])).toEqual(["work", "play"]);
  });

  it("trims whitespace from tags", () => {
    expect(normalizeTags([" work ", "  dev  "])).toEqual(["work", "dev"]);
  });

  it("removes duplicates (case-insensitive)", () => {
    expect(normalizeTags(["Work", "work", "WORK"])).toEqual(["work"]);
  });

  it("removes empty/whitespace-only tags", () => {
    expect(normalizeTags(["", "  ", "valid"])).toEqual(["valid"]);
  });

  it("limits to 20 tags (takes first 20)", () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${String(i)}`);
    expect(normalizeTags(tags)).toHaveLength(20);
  });
});

// ─── isValidTag ───

describe("isValidTag", () => {
  it("rejects empty string", () => {
    expect(isValidTag("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidTag("   ")).toBe(false);
  });

  it("rejects tags longer than 50 characters", () => {
    expect(isValidTag("a".repeat(51))).toBe(false);
  });

  it("accepts a normal tag", () => {
    expect(isValidTag("work")).toBe(true);
  });

  it("accepts a tag with exactly 50 characters", () => {
    expect(isValidTag("a".repeat(50))).toBe(true);
  });
});

// ─── addTag / removeTag ───

describe("addTag", () => {
  it("adds a new tag and updates updatedAt", () => {
    const note = makeNote();
    const result = addTag(note, "work", NOW);

    expect(result.tags).toContain("work");
    expect(result.updatedAt).toBe(NOW);
  });

  it("normalizes the tag (lowercase, trimmed)", () => {
    const note = makeNote();
    const result = addTag(note, " Work ", NOW);

    expect(result.tags).toContain("work");
  });

  it("does not add a duplicate tag", () => {
    const note = makeNote({ tags: ["work"] });
    const result = addTag(note, "work", NOW);

    expect(result.tags).toEqual(["work"]);
  });

  it("does not exceed 20 tags", () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag${String(i)}`);
    const note = makeNote({ tags });
    const result = addTag(note, "newtag", NOW);

    expect(result.tags).toHaveLength(20);
    expect(result.tags).not.toContain("newtag");
  });
});

describe("removeTag", () => {
  it("removes an existing tag and updates updatedAt", () => {
    const note = makeNote({ tags: ["work", "dev"] });
    const result = removeTag(note, "work", NOW);

    expect(result.tags).toEqual(["dev"]);
    expect(result.updatedAt).toBe(NOW);
  });

  it("is a no-op if tag does not exist", () => {
    const note = makeNote({ tags: ["work"] });
    const result = removeTag(note, "missing", NOW);

    expect(result.tags).toEqual(["work"]);
  });

  it("normalizes the tag before removing", () => {
    const note = makeNote({ tags: ["work"] });
    const result = removeTag(note, " WORK ", NOW);

    expect(result.tags).toEqual([]);
  });
});

// ─── pinNote / unpinNote ───

describe("pinNote", () => {
  it("sets pinned to true and updates updatedAt", () => {
    const note = makeNote({ pinned: false });
    const result = pinNote(note, NOW);

    expect(result.pinned).toBe(true);
    expect(result.updatedAt).toBe(NOW);
  });

  it("still updates updatedAt on already-pinned note", () => {
    const note = makeNote({ pinned: true });
    const result = pinNote(note, NOW);

    expect(result.pinned).toBe(true);
    expect(result.updatedAt).toBe(NOW);
  });
});

describe("unpinNote", () => {
  it("sets pinned to false and updates updatedAt", () => {
    const note = makeNote({ pinned: true });
    const result = unpinNote(note, NOW);

    expect(result.pinned).toBe(false);
    expect(result.updatedAt).toBe(NOW);
  });
});

// ─── folderId ───

describe("folderId", () => {
  it("createNote defaults folderId to null when not provided", () => {
    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );
    expect(note.folderId).toBeNull();
  });

  it("createNote accepts a folderId", () => {
    const folderId = "fld00000-0000-0000-0000-000000000000" as UUID;
    const note = createNote(
      {
        title: "T",
        contentRich: null,
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
        folderId,
      },
      "660e8400-e29b-41d4-a716-446655440000" as UUID,
      "550e8400-e29b-41d4-a716-446655440000" as UUID,
      NOW,
    );
    expect(note.folderId).toBe(folderId);
  });

  it("updateNote can change folderId", () => {
    const note = makeNote();
    const folderId = "fld00000-0000-0000-0000-000000000000" as UUID;
    const updated = updateNote(note, { folderId }, NOW);
    expect(updated.folderId).toBe(folderId);
  });

  it("updateNote can clear folderId to null", () => {
    const folderId = "fld00000-0000-0000-0000-000000000000" as UUID;
    const note = makeNote({ folderId });
    const updated = updateNote(note, { folderId: null }, NOW);
    expect(updated.folderId).toBeNull();
  });

  it("serializeNote includes folderId", () => {
    const folderId = "fld00000-0000-0000-0000-000000000000" as UUID;
    const note = makeNote({ folderId });
    const serialized = serializeNote(note);
    expect(serialized["folderId"]).toBe(folderId);
  });
});
