import { describe, it, expect } from "vitest";
import type { UUID, ISODateString, CreateProcessingJobInput } from "./types";
import { ProcessingJobKind, ProcessingJobStatus } from "./types";
import {
  createProcessingJob,
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
  cancelJob,
  isValidJobTransition,
  isTerminalStatus,
} from "./processing-job";

// ─── Helpers ───

const uuid = (s: string) => s as UUID;
const iso = (s: string) => s as ISODateString;

function makeJobInput(
  overrides?: Partial<CreateProcessingJobInput>,
): CreateProcessingJobInput {
  return {
    noteId: uuid("note-1"),
    userId: uuid("user-1"),
    kind: ProcessingJobKind.SUMMARIZE,
    ...overrides,
  };
}

const NOW = iso("2025-01-01T00:00:00.000Z");
const LATER = iso("2025-01-01T00:01:00.000Z");
const EVEN_LATER = iso("2025-01-01T00:02:00.000Z");

// ─── createProcessingJob ───

describe("createProcessingJob", () => {
  it("creates a QUEUED job with defaults", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);

    expect(job.id).toBe("job-1");
    expect(job.noteId).toBe("note-1");
    expect(job.userId).toBe("user-1");
    expect(job.kind).toBe(ProcessingJobKind.SUMMARIZE);
    expect(job.status).toBe(ProcessingJobStatus.QUEUED);
    expect(job.progressPct).toBe(0);
    expect(job.message).toBeNull();
    expect(job.startedAt).toBeNull();
    expect(job.endedAt).toBeNull();
    expect(job.error).toBeNull();
    expect(job.createdAt).toBe(NOW);
    expect(job.updatedAt).toBe(NOW);
  });

  it("respects the provided kind", () => {
    const job = createProcessingJob(
      makeJobInput({ kind: ProcessingJobKind.EXPORT_PDF }),
      uuid("job-2"),
      NOW,
    );
    expect(job.kind).toBe(ProcessingJobKind.EXPORT_PDF);
  });
});

// ─── startJob ───

describe("startJob", () => {
  it("transitions QUEUED → RUNNING", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);

    expect(started.status).toBe(ProcessingJobStatus.RUNNING);
    expect(started.startedAt).toBe(LATER);
    expect(started.updatedAt).toBe(LATER);
    expect(started.progressPct).toBe(0);
  });

  it("throws on invalid transition from COMPLETED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const completed = completeJob(started, EVEN_LATER);

    expect(() => startJob(completed, EVEN_LATER)).toThrow(
      /invalid transition/i,
    );
  });

  it("throws on invalid transition from FAILED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const failed = failJob(started, "oops", EVEN_LATER);

    expect(() => startJob(failed, EVEN_LATER)).toThrow(/invalid transition/i);
  });

  it("throws on invalid transition from CANCELLED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const cancelled = cancelJob(job, LATER);

    expect(() => startJob(cancelled, EVEN_LATER)).toThrow(
      /invalid transition/i,
    );
  });
});

// ─── updateJobProgress ───

describe("updateJobProgress", () => {
  it("updates progressPct and message on a RUNNING job", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const updated = updateJobProgress(started, 50, "Halfway done", EVEN_LATER);

    expect(updated.progressPct).toBe(50);
    expect(updated.message).toBe("Halfway done");
    expect(updated.updatedAt).toBe(EVEN_LATER);
    expect(updated.status).toBe(ProcessingJobStatus.RUNNING);
  });

  it("clamps progressPct to 0", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const updated = updateJobProgress(started, -10, null, EVEN_LATER);

    expect(updated.progressPct).toBe(0);
  });

  it("clamps progressPct to 100", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const updated = updateJobProgress(started, 150, null, EVEN_LATER);

    expect(updated.progressPct).toBe(100);
  });

  it("throws when job is not RUNNING", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    expect(() => updateJobProgress(job, 50, null, LATER)).toThrow(
      /can only update progress.*running/i,
    );
  });

  it("allows null message", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const updated = updateJobProgress(started, 25, null, EVEN_LATER);

    expect(updated.message).toBeNull();
  });
});

// ─── completeJob ───

describe("completeJob", () => {
  it("transitions RUNNING → COMPLETED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const completed = completeJob(started, EVEN_LATER);

    expect(completed.status).toBe(ProcessingJobStatus.COMPLETED);
    expect(completed.progressPct).toBe(100);
    expect(completed.endedAt).toBe(EVEN_LATER);
    expect(completed.updatedAt).toBe(EVEN_LATER);
    expect(completed.error).toBeNull();
  });

  it("throws on invalid transition from QUEUED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    expect(() => completeJob(job, LATER)).toThrow(/invalid transition/i);
  });
});

// ─── failJob ───

describe("failJob", () => {
  it("transitions RUNNING → FAILED with error", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const failed = failJob(started, "Out of memory", EVEN_LATER);

    expect(failed.status).toBe(ProcessingJobStatus.FAILED);
    expect(failed.error).toBe("Out of memory");
    expect(failed.endedAt).toBe(EVEN_LATER);
    expect(failed.updatedAt).toBe(EVEN_LATER);
  });

  it("throws on invalid transition from QUEUED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    expect(() => failJob(job, "error", LATER)).toThrow(/invalid transition/i);
  });
});

// ─── cancelJob ───

describe("cancelJob", () => {
  it("transitions QUEUED → CANCELLED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const cancelled = cancelJob(job, LATER);

    expect(cancelled.status).toBe(ProcessingJobStatus.CANCELLED);
    expect(cancelled.endedAt).toBe(LATER);
    expect(cancelled.updatedAt).toBe(LATER);
  });

  it("transitions RUNNING → CANCELLED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const cancelled = cancelJob(started, EVEN_LATER);

    expect(cancelled.status).toBe(ProcessingJobStatus.CANCELLED);
    expect(cancelled.endedAt).toBe(EVEN_LATER);
  });

  it("throws on invalid transition from COMPLETED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const completed = completeJob(started, EVEN_LATER);

    expect(() => cancelJob(completed, EVEN_LATER)).toThrow(
      /invalid transition/i,
    );
  });

  it("throws on invalid transition from FAILED", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const started = startJob(job, LATER);
    const failed = failJob(started, "err", EVEN_LATER);

    expect(() => cancelJob(failed, EVEN_LATER)).toThrow(/invalid transition/i);
  });

  it("throws on already CANCELLED job", () => {
    const job = createProcessingJob(makeJobInput(), uuid("job-1"), NOW);
    const cancelled = cancelJob(job, LATER);

    expect(() => cancelJob(cancelled, EVEN_LATER)).toThrow(
      /invalid transition/i,
    );
  });
});

// ─── isValidJobTransition ───

describe("isValidJobTransition", () => {
  const valid: [ProcessingJobStatus, ProcessingJobStatus][] = [
    [ProcessingJobStatus.QUEUED, ProcessingJobStatus.RUNNING],
    [ProcessingJobStatus.QUEUED, ProcessingJobStatus.CANCELLED],
    [ProcessingJobStatus.RUNNING, ProcessingJobStatus.COMPLETED],
    [ProcessingJobStatus.RUNNING, ProcessingJobStatus.FAILED],
    [ProcessingJobStatus.RUNNING, ProcessingJobStatus.CANCELLED],
  ];

  for (const [from, to] of valid) {
    it(`allows ${from} → ${to}`, () => {
      expect(isValidJobTransition(from, to)).toBe(true);
    });
  }

  const invalid: [ProcessingJobStatus, ProcessingJobStatus][] = [
    [ProcessingJobStatus.QUEUED, ProcessingJobStatus.COMPLETED],
    [ProcessingJobStatus.QUEUED, ProcessingJobStatus.FAILED],
    [ProcessingJobStatus.RUNNING, ProcessingJobStatus.QUEUED],
    [ProcessingJobStatus.COMPLETED, ProcessingJobStatus.RUNNING],
    [ProcessingJobStatus.COMPLETED, ProcessingJobStatus.CANCELLED],
    [ProcessingJobStatus.FAILED, ProcessingJobStatus.RUNNING],
    [ProcessingJobStatus.FAILED, ProcessingJobStatus.CANCELLED],
    [ProcessingJobStatus.CANCELLED, ProcessingJobStatus.RUNNING],
    [ProcessingJobStatus.CANCELLED, ProcessingJobStatus.QUEUED],
  ];

  for (const [from, to] of invalid) {
    it(`rejects ${from} → ${to}`, () => {
      expect(isValidJobTransition(from, to)).toBe(false);
    });
  }
});

// ─── isTerminalStatus ───

describe("isTerminalStatus", () => {
  it("returns true for COMPLETED", () => {
    expect(isTerminalStatus(ProcessingJobStatus.COMPLETED)).toBe(true);
  });

  it("returns true for FAILED", () => {
    expect(isTerminalStatus(ProcessingJobStatus.FAILED)).toBe(true);
  });

  it("returns true for CANCELLED", () => {
    expect(isTerminalStatus(ProcessingJobStatus.CANCELLED)).toBe(true);
  });

  it("returns false for QUEUED", () => {
    expect(isTerminalStatus(ProcessingJobStatus.QUEUED)).toBe(false);
  });

  it("returns false for RUNNING", () => {
    expect(isTerminalStatus(ProcessingJobStatus.RUNNING)).toBe(false);
  });
});
