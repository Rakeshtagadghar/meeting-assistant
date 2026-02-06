import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { UUID } from "@ainotes/core";
import { createAISummariesRepository } from "./ai-summaries.repo";
import type { AISummariesRepository } from "./ai-summaries.repo";
import { createNotesRepository } from "./notes.repo";
import type { NotesRepository } from "./notes.repo";
import {
  getTestClient,
  cleanDatabase,
  createTestUser,
  disconnectTestClient,
} from "../test-utils/helpers";

describe("AISummariesRepository (integration)", () => {
  let prisma: PrismaClient;
  let summaryRepo: AISummariesRepository;
  let notesRepo: NotesRepository;
  let testUserId: UUID;
  let testNoteId: UUID;

  beforeAll(async () => {
    prisma = getTestClient();
    summaryRepo = createAISummariesRepository(prisma);
    notesRepo = createNotesRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const user = await createTestUser(prisma);
    testUserId = user.id;

    const note = await notesRepo.create(testUserId, {
      title: "Note for summary",
      contentRich: {},
      contentPlain: "Some content here",
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
    it("creates a SUMMARY kind", async () => {
      const summary = await summaryRepo.create({
        noteId: testNoteId,
        meetingSessionId: null,
        kind: "SUMMARY",
        payload: {
          title: "Summary Title",
          bullets: ["Point 1", "Point 2"],
          oneLiner: "A short summary",
        },
        modelInfo: { provider: "extractive", version: "1.0" },
      });

      expect(summary.id).toBeDefined();
      expect(summary.noteId).toBe(testNoteId);
      expect(summary.kind).toBe("SUMMARY");
      expect(summary.payload).toEqual({
        title: "Summary Title",
        bullets: ["Point 1", "Point 2"],
        oneLiner: "A short summary",
      });
    });

    it("creates an ACTION_ITEMS kind", async () => {
      const summary = await summaryRepo.create({
        noteId: testNoteId,
        meetingSessionId: null,
        kind: "ACTION_ITEMS",
        payload: {
          items: [
            { text: "Do task", owner: "Alice", due: null, confidence: 0.9 },
          ],
        },
        modelInfo: {},
      });

      expect(summary.kind).toBe("ACTION_ITEMS");
    });
  });

  // ─── FIND BY NOTE ───

  describe("findByNote", () => {
    it("returns all summaries for a note", async () => {
      await summaryRepo.create({
        noteId: testNoteId,
        meetingSessionId: null,
        kind: "SUMMARY",
        payload: { title: "S1", bullets: [], oneLiner: "" },
        modelInfo: {},
      });
      await summaryRepo.create({
        noteId: testNoteId,
        meetingSessionId: null,
        kind: "ACTION_ITEMS",
        payload: { items: [] },
        modelInfo: {},
      });

      const summaries = await summaryRepo.findByNote(testNoteId);
      expect(summaries).toHaveLength(2);
    });

    it("returns empty array when no summaries exist", async () => {
      const summaries = await summaryRepo.findByNote(testNoteId);
      expect(summaries).toEqual([]);
    });

    it("does not return summaries from other notes", async () => {
      const otherNote = await notesRepo.create(testUserId, {
        title: "Other",
        contentRich: {},
        contentPlain: "",
        type: "FREEFORM",
        tags: [],
      });

      await summaryRepo.create({
        noteId: otherNote.id,
        meetingSessionId: null,
        kind: "SUMMARY",
        payload: { title: "Other", bullets: [], oneLiner: "" },
        modelInfo: {},
      });

      const summaries = await summaryRepo.findByNote(testNoteId);
      expect(summaries).toEqual([]);
    });
  });
});
