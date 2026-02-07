import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { UUID } from "@ainotes/core";
import { createProcessingJobsRepository } from "./processing-jobs.repo";
import type { ProcessingJobsRepository } from "./processing-jobs.repo";
import {
  getTestClient,
  cleanDatabase,
  createTestUser,
  disconnectTestClient,
} from "../test-utils/helpers";

describe("ProcessingJobsRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: ProcessingJobsRepository;
  let testUserId: UUID;
  let otherUserId: UUID;

  beforeAll(async () => {
    prisma = getTestClient();
    repo = createProcessingJobsRepository(prisma);
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

  /** Helper: create a note owned by the given user. */
  async function createNote(userId: UUID) {
    return prisma.note.create({
      data: {
        userId,
        title: "Test Note",
        contentPlain: "",
        contentRich: {},
        type: "FREEFORM",
        tags: [],
      },
    });
  }

  // ─── CREATE ───

  describe("create", () => {
    it("creates a job with QUEUED status and progressPct 0", async () => {
      const note = await createNote(testUserId);

      const job = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe("QUEUED");
      expect(job.progressPct).toBe(0);
      expect(job.message).toBeNull();
      expect(job.startedAt).toBeNull();
      expect(job.endedAt).toBeNull();
      expect(job.error).toBeNull();
      expect(job.createdAt).toBeDefined();
      expect(job.updatedAt).toBeDefined();
    });

    it("stores the correct kind", async () => {
      const note = await createNote(testUserId);

      const job = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "EXTRACT_ACTIONS",
      });

      expect(job.kind).toBe("EXTRACT_ACTIONS");
    });

    it("associates the job with the correct noteId and userId", async () => {
      const note = await createNote(testUserId);

      const job = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "GENERATE_HTML",
      });

      expect(job.noteId).toBe(note.id);
      expect(job.userId).toBe(testUserId);
    });
  });

  // ─── FIND BY ID ───

  describe("findById", () => {
    it("returns the job when it belongs to the user", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const found = await repo.findById(created.id, testUserId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.kind).toBe("SUMMARIZE");
    });

    it("returns null when the job belongs to a different user (RLS)", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const found = await repo.findById(created.id, otherUserId);
      expect(found).toBeNull();
    });

    it("returns null for a non-existent id", async () => {
      const found = await repo.findById(
        "00000000-0000-0000-0000-000000000000" as UUID,
        testUserId,
      );
      expect(found).toBeNull();
    });
  });

  // ─── FIND BY NOTE ───

  describe("findByNote", () => {
    it("returns all jobs for the note belonging to the user", async () => {
      const note = await createNote(testUserId);
      await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });
      await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "EXPORT_PDF",
      });

      const jobs = await repo.findByNote(note.id as UUID, testUserId);
      expect(jobs).toHaveLength(2);
    });

    it("returns empty array when querying as a different user (RLS)", async () => {
      const note = await createNote(testUserId);
      await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const jobs = await repo.findByNote(note.id as UUID, otherUserId);
      expect(jobs).toHaveLength(0);
    });

    it("orders jobs by createdAt descending (newest first)", async () => {
      const note = await createNote(testUserId);

      const first = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });
      const second = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "EXPORT_PDF",
      });

      const jobs = await repo.findByNote(note.id as UUID, testUserId);
      expect(jobs[0]!.id).toBe(second.id);
      expect(jobs[1]!.id).toBe(first.id);
    });

    it("returns empty array when no jobs exist for the note", async () => {
      const note = await createNote(testUserId);

      const jobs = await repo.findByNote(note.id as UUID, testUserId);
      expect(jobs).toEqual([]);
    });
  });

  // ─── UPDATE ───

  describe("update", () => {
    it("updates status from QUEUED to RUNNING", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const updated = await repo.update(created.id, {
        status: "RUNNING",
      });

      expect(updated.status).toBe("RUNNING");
      expect(updated.id).toBe(created.id);
    });

    it("updates progressPct and message together", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const updated = await repo.update(created.id, {
        progressPct: 50,
        message: "Halfway there",
      });

      expect(updated.progressPct).toBe(50);
      expect(updated.message).toBe("Halfway there");
    });

    it("sets startedAt when job begins processing", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "EXPORT_DOCX",
      });

      const startTime = new Date();
      const updated = await repo.update(created.id, {
        status: "RUNNING",
        startedAt: startTime,
      });

      expect(updated.startedAt).not.toBeNull();
      expect(new Date(updated.startedAt!).getTime()).toBe(startTime.getTime());
    });

    it("sets endedAt when job completes", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const endTime = new Date();
      const updated = await repo.update(created.id, {
        status: "COMPLETED",
        progressPct: 100,
        endedAt: endTime,
      });

      expect(updated.status).toBe("COMPLETED");
      expect(updated.progressPct).toBe(100);
      expect(updated.endedAt).not.toBeNull();
      expect(new Date(updated.endedAt!).getTime()).toBe(endTime.getTime());
    });

    it("sets error field when job fails", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "EXPORT_PDF",
      });

      const endTime = new Date();
      const updated = await repo.update(created.id, {
        status: "FAILED",
        error: "PDF generation timed out",
        endedAt: endTime,
      });

      expect(updated.status).toBe("FAILED");
      expect(updated.error).toBe("PDF generation timed out");
      expect(updated.endedAt).not.toBeNull();
    });

    it("clears message by setting it to null", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      await repo.update(created.id, { message: "Processing..." });
      const cleared = await repo.update(created.id, { message: null });

      expect(cleared.message).toBeNull();
    });

    it("bumps updatedAt on update", async () => {
      const note = await createNote(testUserId);
      const created = await repo.create({
        noteId: note.id as UUID,
        userId: testUserId,
        kind: "SUMMARIZE",
      });

      const updated = await repo.update(created.id, {
        status: "RUNNING",
      });

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
    });
  });
});
