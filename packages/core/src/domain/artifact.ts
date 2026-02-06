import type {
  NoteArtifact,
  UUID,
  ISODateString,
  CreateArtifactInput,
  ArtifactStatus,
} from "./types";
import { ArtifactStatus as Status, ArtifactType } from "./types";

// ─── Valid state transitions ───

const VALID_TRANSITIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [Status.NOT_READY, [Status.GENERATING]],
  [Status.GENERATING, [Status.READY, Status.FAILED]],
  [Status.READY, []],
  [Status.FAILED, []],
]);

export function isValidArtifactTransition(
  from: ArtifactStatus,
  to: ArtifactStatus,
): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.includes(to);
}

function assertTransition(from: ArtifactStatus, to: ArtifactStatus): void {
  if (!isValidArtifactTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

// ─── Factory ───

export function createArtifact(
  input: CreateArtifactInput,
  id: UUID,
  now: ISODateString,
): NoteArtifact {
  return {
    id,
    noteId: input.noteId,
    jobId: input.jobId,
    type: input.type,
    status: Status.NOT_READY,
    storagePath: null,
    hash: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Transitions ───

export function startGeneratingArtifact(
  artifact: NoteArtifact,
  now: ISODateString,
): NoteArtifact {
  assertTransition(artifact.status, Status.GENERATING);
  return {
    ...artifact,
    status: Status.GENERATING,
    updatedAt: now,
  };
}

export function completeArtifact(
  artifact: NoteArtifact,
  storagePath: string,
  hash: string,
  now: ISODateString,
): NoteArtifact {
  assertTransition(artifact.status, Status.READY);
  return {
    ...artifact,
    status: Status.READY,
    storagePath,
    hash,
    updatedAt: now,
  };
}

export function failArtifact(
  artifact: NoteArtifact,
  now: ISODateString,
): NoteArtifact {
  assertTransition(artifact.status, Status.FAILED);
  return {
    ...artifact,
    status: Status.FAILED,
    updatedAt: now,
  };
}

// ─── Queries ───

export function canDownload(artifact: NoteArtifact): boolean {
  return artifact.status === Status.READY;
}

export function isExportAllowed(artifacts: readonly NoteArtifact[]): boolean {
  const htmlSummary = artifacts.find(
    (a) => a.type === ArtifactType.HTML_SUMMARY,
  );
  return htmlSummary !== undefined && htmlSummary.status === Status.READY;
}
