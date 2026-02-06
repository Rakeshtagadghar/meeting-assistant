import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { UUID } from "@ainotes/core";
import { createNotesRepository } from "./notes.repo";
import type { NotesRepository } from "./notes.repo";
import {
  getTestClient,
  cleanDatabase,
  createTestUser,
  disconnectTestClient,
} from "../test-utils/helpers";

describe("NotesRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: NotesRepository;
  let testUserId: UUID;
  let otherUserId: UUID;

  beforeAll(async () => {
    prisma = getTestClient();
    repo = createNotesRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const user = await createTestUser(prisma);
    testUserId = user.id;
    const other = await createTestUser(prisma, { email: "other@example.com" });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await disconnectTestClient();
  });

  // ─── CREATE ───

  describe("create", () => {
    it("creates a note and returns it with an id", async () => {
      const note = await repo.create(testUserId, {
        title: "Test Note",
        contentRich: { type: "doc", content: [] },
        contentPlain: "hello",
        type: "FREEFORM",
        tags: ["work"],
      });

      expect(note.id).toBeDefined();
      expect(note.title).toBe("Test Note");
      expect(note.userId).toBe(testUserId);
      expect(note.tags).toEqual(["work"]);
      expect(note.pinned).toBe(false);
      expect(note.deletedAt).toBeNull();
      expect(note.type).toBe("FREEFORM");
    });

    it("creates a MEETING type note", async () => {
      const note = await repo.create(testUserId, {
        title: "Standup",
        contentRich: {},
        contentPlain: "",
        type: "MEETING",
        tags: [],
      });

      expect(note.type).toBe("MEETING");
    });

    it("stores contentRich as JSON", async () => {
      const richContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };
      const note = await repo.create(testUserId, {
        title: "Rich",
        contentRich: richContent,
        contentPlain: "Hello world",
        type: "FREEFORM",
        tags: [],
      });

      expect(note.contentRich).toEqual(richContent);
    });
  });

  // ─── FIND BY ID ───

  describe("findById", () => {
    it("returns the note when it belongs to the user", async () => {
      const created = await repo.create(testUserId, {
        title: "Find Me",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      const found = await repo.findById(created.id, testUserId);
      expect(found).not.toBeNull();
      expect(found!.title).toBe("Find Me");
    });

    it("returns null when note belongs to a different user (RLS)", async () => {
      const created = await repo.create(testUserId, {
        title: "Private",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      const found = await repo.findById(created.id, otherUserId);
      expect(found).toBeNull();
    });

    it("returns null for non-existent id", async () => {
      const found = await repo.findById(
        "00000000-0000-0000-0000-000000000000" as UUID,
        testUserId,
      );
      expect(found).toBeNull();
    });

    it("returns null for soft-deleted notes", async () => {
      const created = await repo.create(testUserId, {
        title: "Deleted",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.softDelete(created.id, testUserId);

      const found = await repo.findById(created.id, testUserId);
      expect(found).toBeNull();
    });
  });

  // ─── FIND BY USER ───

  describe("findByUser", () => {
    it("returns only notes belonging to the user", async () => {
      await repo.create(testUserId, {
        title: "Mine",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.create(otherUserId, {
        title: "Not Mine",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      const notes = await repo.findByUser(testUserId);
      expect(notes).toHaveLength(1);
      expect(notes[0]!.title).toBe("Mine");
    });

    it("excludes soft-deleted notes by default", async () => {
      const created = await repo.create(testUserId, {
        title: "Deleted",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.softDelete(created.id, testUserId);

      const notes = await repo.findByUser(testUserId);
      expect(notes).toHaveLength(0);
    });

    it("filters by tag", async () => {
      await repo.create(testUserId, {
        title: "Tagged",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: ["work"],
      });
      await repo.create(testUserId, {
        title: "Untagged",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: ["personal"],
      });

      const notes = await repo.findByUser(testUserId, { tag: "work" });
      expect(notes).toHaveLength(1);
      expect(notes[0]!.title).toBe("Tagged");
    });

    it("filters by pinned", async () => {
      const n = await repo.create(testUserId, {
        title: "Pinned",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.update(n.id, testUserId, { pinned: true });
      await repo.create(testUserId, {
        title: "Not Pinned",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      const notes = await repo.findByUser(testUserId, { pinned: true });
      expect(notes).toHaveLength(1);
      expect(notes[0]!.title).toBe("Pinned");
    });

    it("searches by text query in title", async () => {
      await repo.create(testUserId, {
        title: "Meeting with Alice",
        contentRich: {},
        contentPlain: "",
        type: "MEETING",
        tags: [],
      });
      await repo.create(testUserId, {
        title: "Shopping List",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      const notes = await repo.findByUser(testUserId, { q: "Alice" });
      expect(notes).toHaveLength(1);
      expect(notes[0]!.title).toContain("Alice");
    });

    it("searches case-insensitively", async () => {
      await repo.create(testUserId, {
        title: "Meeting with Alice",
        contentRich: {},
        contentPlain: "",
        type: "MEETING",
        tags: [],
      });

      const notes = await repo.findByUser(testUserId, { q: "alice" });
      expect(notes).toHaveLength(1);
    });

    it("orders by updatedAt descending", async () => {
      const n1 = await repo.create(testUserId, {
        title: "First",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.create(testUserId, {
        title: "Second",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.update(n1.id, testUserId, { title: "First Updated" });

      const notes = await repo.findByUser(testUserId);
      expect(notes[0]!.title).toBe("First Updated");
    });

    it("returns empty array for user with no notes", async () => {
      const notes = await repo.findByUser(testUserId);
      expect(notes).toEqual([]);
    });
  });

  // ─── UPDATE ───

  describe("update", () => {
    it("updates title and bumps updatedAt", async () => {
      const created = await repo.create(testUserId, {
        title: "Old",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      const updated = await repo.update(created.id, testUserId, {
        title: "New",
      });

      expect(updated.title).toBe("New");
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it("updates tags", async () => {
      const created = await repo.create(testUserId, {
        title: "T",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: ["old"],
      });
      const updated = await repo.update(created.id, testUserId, {
        tags: ["new", "tags"],
      });

      expect(updated.tags).toEqual(["new", "tags"]);
    });

    it("updates pinned status", async () => {
      const created = await repo.create(testUserId, {
        title: "T",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      const updated = await repo.update(created.id, testUserId, {
        pinned: true,
      });

      expect(updated.pinned).toBe(true);
    });

    it("throws when updating another user's note (RLS)", async () => {
      const created = await repo.create(testUserId, {
        title: "Mine",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      await expect(
        repo.update(created.id, otherUserId, { title: "Hacked" }),
      ).rejects.toThrow();
    });
  });

  // ─── SOFT DELETE ───

  describe("softDelete", () => {
    it("sets deletedAt on the note", async () => {
      const created = await repo.create(testUserId, {
        title: "Delete Me",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      const deleted = await repo.softDelete(created.id, testUserId);

      expect(deleted.deletedAt).not.toBeNull();
    });

    it("throws when deleting another user's note (RLS)", async () => {
      const created = await repo.create(testUserId, {
        title: "Mine",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      await expect(repo.softDelete(created.id, otherUserId)).rejects.toThrow();
    });
  });

  // ─── HARD DELETE ───

  describe("hardDelete", () => {
    it("permanently removes the note", async () => {
      const created = await repo.create(testUserId, {
        title: "Gone",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });
      await repo.hardDelete(created.id, testUserId);

      const found = await prisma.note.findUnique({
        where: { id: created.id },
      });
      expect(found).toBeNull();
    });

    it("throws when deleting another user's note (RLS)", async () => {
      const created = await repo.create(testUserId, {
        title: "Mine",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      await expect(repo.hardDelete(created.id, otherUserId)).rejects.toThrow();
    });
  });
});
