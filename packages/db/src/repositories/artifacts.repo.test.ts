import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { UUID } from "@ainotes/core";
import { createArtifactsRepository } from "./artifacts.repo";
import type { ArtifactsRepository } from "./artifacts.repo";
import {
  getTestClient,
  cleanDatabase,
  createTestUser,
  disconnectTestClient,
} from "../test-utils/helpers";

describe("ArtifactsRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: ArtifactsRepository;
  let testUserId: UUID;

  beforeAll(async () => {
    prisma = getTestClient();
    repo = createArtifactsRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const user = await createTestUser(prisma);
    testUserId = user.id;
  });

  afterAll(async () => {
    await disconnectTestClient();
  });

  /** Helper: create a Note + NoteProcessingJob pair (FK dependencies). */
  async function createNoteAndJob() {
    const note = await prisma.note.create({
      data: {
        userId: testUserId,
        title: "Test",
        contentPlain: "",
        contentRich: {},
        type: "FREEFORM",
        tags: [],
      },
    });
    const job = await prisma.noteProcessingJob.create({
      data: {
        noteId: note.id,
        userId: testUserId,
        kind: "SUMMARIZE",
      },
    });
    return { note, job };
  }

  // ─── CREATE ───

  describe("create", () => {
    it("creates an artifact with NOT_READY status by default", async () => {
      const { note, job } = await createNoteAndJob();

      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      expect(artifact.id).toBeDefined();
      expect(artifact.status).toBe("NOT_READY");
    });

    it("stores the correct artifact type", async () => {
      const { note, job } = await createNoteAndJob();

      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "PDF",
      });

      expect(artifact.type).toBe("PDF");
    });

    it("associates the artifact with the correct noteId and jobId", async () => {
      const { note, job } = await createNoteAndJob();

      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "HTML_SUMMARY",
      });

      expect(artifact.noteId).toBe(note.id);
      expect(artifact.jobId).toBe(job.id);
    });

    it("initialises storagePath and hash as null", async () => {
      const { note, job } = await createNoteAndJob();

      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "DOCX",
      });

      expect(artifact.storagePath).toBeNull();
      expect(artifact.hash).toBeNull();
    });

    it("populates createdAt and updatedAt timestamps", async () => {
      const { note, job } = await createNoteAndJob();

      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      expect(artifact.createdAt).toBeDefined();
      expect(artifact.updatedAt).toBeDefined();
    });
  });

  // ─── FIND BY JOB ───

  describe("findByJob", () => {
    it("returns all artifacts for a given job", async () => {
      const { note, job } = await createNoteAndJob();

      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });
      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "HTML_SUMMARY",
      });

      const artifacts = await repo.findByJob(job.id as UUID);
      expect(artifacts).toHaveLength(2);
    });

    it("does not return artifacts belonging to a different job", async () => {
      const { note, job: job1 } = await createNoteAndJob();
      const job2 = await prisma.noteProcessingJob.create({
        data: { noteId: note.id, userId: testUserId, kind: "EXPORT_PDF" },
      });

      await repo.create({
        noteId: note.id as UUID,
        jobId: job1.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });
      await repo.create({
        noteId: note.id as UUID,
        jobId: job2.id as UUID,
        type: "PDF",
      });

      const artifacts = await repo.findByJob(job1.id as UUID);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.type).toBe("MARKDOWN_SUMMARY");
    });

    it("returns an empty array for a non-existent job id", async () => {
      const artifacts = await repo.findByJob(
        "00000000-0000-0000-0000-000000000000" as UUID,
      );
      expect(artifacts).toEqual([]);
    });
  });

  // ─── FIND BY NOTE AND TYPE ───

  describe("findByNoteAndType", () => {
    it("returns the artifact matching the note and type", async () => {
      const { note, job } = await createNoteAndJob();

      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      const found = await repo.findByNoteAndType(
        note.id as UUID,
        "MARKDOWN_SUMMARY",
      );
      expect(found).not.toBeNull();
      expect(found!.type).toBe("MARKDOWN_SUMMARY");
      expect(found!.noteId).toBe(note.id);
    });

    it("returns the latest artifact when multiple of the same type exist", async () => {
      const { note, job: job1 } = await createNoteAndJob();
      const job2 = await prisma.noteProcessingJob.create({
        data: { noteId: note.id, userId: testUserId, kind: "SUMMARIZE" },
      });

      await repo.create({
        noteId: note.id as UUID,
        jobId: job1.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });
      const second = await repo.create({
        noteId: note.id as UUID,
        jobId: job2.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      const found = await repo.findByNoteAndType(
        note.id as UUID,
        "MARKDOWN_SUMMARY",
      );
      expect(found).not.toBeNull();
      // The repo orders by createdAt desc, so the latest (second) should be returned
      expect(found!.id).toBe(second.id);
    });

    it("returns null when no artifact of the requested type exists", async () => {
      const { note, job } = await createNoteAndJob();

      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      const found = await repo.findByNoteAndType(note.id as UUID, "PDF");
      expect(found).toBeNull();
    });

    it("returns null for a non-existent note id", async () => {
      const found = await repo.findByNoteAndType(
        "00000000-0000-0000-0000-000000000000" as UUID,
        "MARKDOWN_SUMMARY",
      );
      expect(found).toBeNull();
    });
  });

  // ─── FIND BY NOTE ───

  describe("findByNote", () => {
    it("returns all artifacts for a given note", async () => {
      const { note, job } = await createNoteAndJob();

      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });
      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "PDF",
      });
      await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "DOCX",
      });

      const artifacts = await repo.findByNote(note.id as UUID);
      expect(artifacts).toHaveLength(3);
    });

    it("does not return artifacts belonging to a different note", async () => {
      const { note: note1, job: job1 } = await createNoteAndJob();
      const note2 = await prisma.note.create({
        data: {
          userId: testUserId,
          title: "Other Note",
          contentPlain: "",
          contentRich: {},
          type: "FREEFORM",
          tags: [],
        },
      });
      const job2 = await prisma.noteProcessingJob.create({
        data: { noteId: note2.id, userId: testUserId, kind: "SUMMARIZE" },
      });

      await repo.create({
        noteId: note1.id as UUID,
        jobId: job1.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });
      await repo.create({
        noteId: note2.id as UUID,
        jobId: job2.id as UUID,
        type: "PDF",
      });

      const artifacts = await repo.findByNote(note1.id as UUID);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.type).toBe("MARKDOWN_SUMMARY");
    });

    it("returns an empty array when the note has no artifacts", async () => {
      const { note } = await createNoteAndJob();

      const artifacts = await repo.findByNote(note.id as UUID);
      expect(artifacts).toEqual([]);
    });
  });

  // ─── UPDATE ───

  describe("update", () => {
    it("transitions status from NOT_READY to GENERATING", async () => {
      const { note, job } = await createNoteAndJob();
      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      const updated = await repo.update(artifact.id, { status: "GENERATING" });

      expect(updated.status).toBe("GENERATING");
      expect(updated.id).toBe(artifact.id);
    });

    it("transitions status from GENERATING to READY", async () => {
      const { note, job } = await createNoteAndJob();
      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "PDF",
      });
      await repo.update(artifact.id, { status: "GENERATING" });

      const updated = await repo.update(artifact.id, { status: "READY" });

      expect(updated.status).toBe("READY");
    });

    it("sets storagePath and hash when marking as READY", async () => {
      const { note, job } = await createNoteAndJob();
      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "DOCX",
      });

      const updated = await repo.update(artifact.id, {
        status: "READY",
        storagePath: "/artifacts/abc-123.docx",
        hash: "sha256:abcdef1234567890",
      });

      expect(updated.status).toBe("READY");
      expect(updated.storagePath).toBe("/artifacts/abc-123.docx");
      expect(updated.hash).toBe("sha256:abcdef1234567890");
    });

    it("transitions status to FAILED", async () => {
      const { note, job } = await createNoteAndJob();
      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "HTML_SUMMARY",
      });

      const updated = await repo.update(artifact.id, { status: "FAILED" });

      expect(updated.status).toBe("FAILED");
    });

    it("bumps updatedAt on update", async () => {
      const { note, job } = await createNoteAndJob();
      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "MARKDOWN_SUMMARY",
      });

      const updated = await repo.update(artifact.id, { status: "GENERATING" });

      expect(updated.updatedAt).not.toBe(artifact.updatedAt);
    });

    it("allows clearing storagePath and hash by setting them to null", async () => {
      const { note, job } = await createNoteAndJob();
      const artifact = await repo.create({
        noteId: note.id as UUID,
        jobId: job.id as UUID,
        type: "PDF",
      });
      await repo.update(artifact.id, {
        status: "READY",
        storagePath: "/artifacts/old.pdf",
        hash: "sha256:old",
      });

      const cleared = await repo.update(artifact.id, {
        storagePath: null,
        hash: null,
      });

      expect(cleared.storagePath).toBeNull();
      expect(cleared.hash).toBeNull();
    });
  });
});
