import type {
  NoteProcessingJob,
  UUID,
  ISODateString,
  CreateProcessingJobInput,
  ProcessingJobStatus,
} from "./types";
import { ProcessingJobStatus as Status } from "./types";

// ─── Valid state transitions ───

const VALID_TRANSITIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [Status.QUEUED, [Status.RUNNING, Status.CANCELLED]],
  [Status.RUNNING, [Status.COMPLETED, Status.FAILED, Status.CANCELLED]],
  [Status.COMPLETED, []],
  [Status.FAILED, []],
  [Status.CANCELLED, []],
]);

export function isValidJobTransition(
  from: ProcessingJobStatus,
  to: ProcessingJobStatus,
): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.includes(to);
}

export function isTerminalStatus(status: ProcessingJobStatus): boolean {
  return (
    status === Status.COMPLETED ||
    status === Status.FAILED ||
    status === Status.CANCELLED
  );
}

function assertTransition(
  from: ProcessingJobStatus,
  to: ProcessingJobStatus,
): void {
  if (!isValidJobTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

// ─── Factory ───

export function createProcessingJob(
  input: CreateProcessingJobInput,
  id: UUID,
  now: ISODateString,
): NoteProcessingJob {
  return {
    id,
    noteId: input.noteId,
    userId: input.userId,
    kind: input.kind,
    status: Status.QUEUED,
    progressPct: 0,
    message: null,
    startedAt: null,
    endedAt: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Transitions ───

export function startJob(
  job: NoteProcessingJob,
  now: ISODateString,
): NoteProcessingJob {
  assertTransition(job.status, Status.RUNNING);
  return {
    ...job,
    status: Status.RUNNING,
    startedAt: now,
    updatedAt: now,
  };
}

export function updateJobProgress(
  job: NoteProcessingJob,
  progressPct: number,
  message: string | null,
  now: ISODateString,
): NoteProcessingJob {
  if (job.status !== Status.RUNNING) {
    throw new Error("Can only update progress on a RUNNING job");
  }
  return {
    ...job,
    progressPct: Math.max(0, Math.min(100, progressPct)),
    message,
    updatedAt: now,
  };
}

export function completeJob(
  job: NoteProcessingJob,
  now: ISODateString,
): NoteProcessingJob {
  assertTransition(job.status, Status.COMPLETED);
  return {
    ...job,
    status: Status.COMPLETED,
    progressPct: 100,
    endedAt: now,
    updatedAt: now,
  };
}

export function failJob(
  job: NoteProcessingJob,
  error: string,
  now: ISODateString,
): NoteProcessingJob {
  assertTransition(job.status, Status.FAILED);
  return {
    ...job,
    status: Status.FAILED,
    error,
    endedAt: now,
    updatedAt: now,
  };
}

export function cancelJob(
  job: NoteProcessingJob,
  now: ISODateString,
): NoteProcessingJob {
  assertTransition(job.status, Status.CANCELLED);
  return {
    ...job,
    status: Status.CANCELLED,
    endedAt: now,
    updatedAt: now,
  };
}
