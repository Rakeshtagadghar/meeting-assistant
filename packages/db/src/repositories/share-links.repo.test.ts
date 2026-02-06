import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { UUID } from "@ainotes/core";
import { createShareLinksRepository } from "./share-links.repo";
import type { ShareLinksRepository } from "./share-links.repo";
import { createNotesRepository } from "./notes.repo";
import type { NotesRepository } from "./notes.repo";
import {
  getTestClient,
  cleanDatabase,
  createTestUser,
  disconnectTestClient,
} from "../test-utils/helpers";

describe("ShareLinksRepository (integration)", () => {
  let prisma: PrismaClient;
  let shareRepo: ShareLinksRepository;
  let notesRepo: NotesRepository;
  let testUserId: UUID;
  let otherUserId: UUID;
  let testNoteId: UUID;

  beforeAll(async () => {
    prisma = getTestClient();
    shareRepo = createShareLinksRepository(prisma);
    notesRepo = createNotesRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const user = await createTestUser(prisma);
    testUserId = user.id;
    const other = await createTestUser(prisma, { email: "other@example.com" });
    otherUserId = other.id;

    const note = await notesRepo.create(testUserId, {
      title: "Shared Note",
      contentRich: {},
      contentPlain: "content",
      type: "FREEFORM",
      tags: [],
    });
    testNoteId = note.id;
  });

  afterAll(async () => {
    await disconnectTestClient();
  });

  // ─── CREATE ───

  describe("create", () => {
    it("creates a share link with a token", async () => {
      const link = await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["alice@example.com"],
          expiresAt: null,
        },
        "test-token-123",
      );

      expect(link.id).toBeDefined();
      expect(link.token).toBe("test-token-123");
      expect(link.noteId).toBe(testNoteId);
      expect(link.createdByUserId).toBe(testUserId);
      expect(link.visibility).toBe("RESTRICTED");
      expect(link.allowedEmails).toEqual(["alice@example.com"]);
    });
  });

  // ─── FIND BY TOKEN ───

  describe("findByToken", () => {
    it("returns the share link for a valid token", async () => {
      await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["alice@example.com"],
          expiresAt: null,
        },
        "find-me-token",
      );

      const found = await shareRepo.findByToken("find-me-token");
      expect(found).not.toBeNull();
      expect(found!.token).toBe("find-me-token");
    });

    it("returns null for non-existent token", async () => {
      const found = await shareRepo.findByToken("nonexistent");
      expect(found).toBeNull();
    });
  });

  // ─── FIND BY NOTE ───

  describe("findByNote", () => {
    it("returns all share links for a note owned by the user", async () => {
      await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["a@example.com"],
          expiresAt: null,
        },
        "token-1",
      );
      await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["b@example.com"],
          expiresAt: null,
        },
        "token-2",
      );

      const links = await shareRepo.findByNote(testNoteId, testUserId);
      expect(links).toHaveLength(2);
    });

    it("returns empty array for other user (RLS)", async () => {
      await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["a@example.com"],
          expiresAt: null,
        },
        "token-rls",
      );

      const links = await shareRepo.findByNote(testNoteId, otherUserId);
      expect(links).toEqual([]);
    });
  });

  // ─── REVOKE ───

  describe("revoke", () => {
    it("deletes the share link", async () => {
      const link = await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["a@example.com"],
          expiresAt: null,
        },
        "revoke-me",
      );

      await shareRepo.revoke(link.id, testUserId);

      const found = await shareRepo.findByToken("revoke-me");
      expect(found).toBeNull();
    });

    it("throws when revoking another user's link (RLS)", async () => {
      const link = await shareRepo.create(
        {
          noteId: testNoteId,
          createdByUserId: testUserId,
          visibility: "RESTRICTED",
          allowedEmails: ["a@example.com"],
          expiresAt: null,
        },
        "not-yours",
      );

      await expect(shareRepo.revoke(link.id, otherUserId)).rejects.toThrow();
    });
  });
});
