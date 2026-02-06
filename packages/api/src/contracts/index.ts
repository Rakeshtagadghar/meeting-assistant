import type {
  Note,
  AISummary,
  NoteProcessingJob,
  NoteArtifact,
  UUID,
  NoteType,
  ShareVisibility,
  ProcessingJobKind,
  ProcessingJobStatus,
  JsonValue,
} from "@ainotes/core";

// ─── Notes ───

export interface CreateNoteRequest {
  readonly title: string;
  readonly contentRich: JsonValue;
  readonly contentPlain?: string;
  readonly type?: NoteType;
  readonly tags?: string[];
  readonly folderId?: string | null;
}

export interface CreateNoteResponse {
  readonly noteId: UUID;
}

export interface ListNotesQuery {
  readonly q?: string;
  readonly tag?: string;
  readonly pinned?: boolean;
}

export interface ListNotesResponse {
  readonly notes: Note[];
}

export interface GetNoteResponse {
  readonly note: Note;
  readonly summaries: AISummary[];
  readonly artifacts: NoteArtifact[];
}

export interface UpdateNoteRequest {
  readonly title?: string;
  readonly contentRich?: JsonValue;
  readonly contentPlain?: string;
  readonly tags?: string[];
  readonly pinned?: boolean;
  readonly folderId?: string | null;
}

export interface OkResponse {
  readonly ok: true;
}

// ─── Generate Pipeline ───

export type GenerateMode = "SHORT" | "MEDIUM" | "DETAILED";

export interface GenerateRequest {
  readonly noteId: UUID;
  readonly kinds?: ProcessingJobKind[];
  readonly mode?: GenerateMode;
}

export interface GenerateResponse {
  readonly jobId: UUID;
}

export interface JobStatusResponse {
  readonly job: NoteProcessingJob;
  readonly artifacts: NoteArtifact[];
}

export interface CancelJobResponse {
  readonly ok: true;
}

// ─── Export ───

export interface ExportRequest {
  readonly noteId: UUID;
}

export interface ExportResponse {
  readonly jobId: UUID;
}

// ─── SSE Events ───

export interface JobProgressEvent {
  readonly progressPct: number;
  readonly message: string | null;
  readonly status: ProcessingJobStatus;
}

export interface JobDoneEvent {
  readonly status: ProcessingJobStatus;
  readonly artifacts: NoteArtifact[];
}

// ─── Share ───

export interface CreateShareLinkRequest {
  readonly noteId: UUID;
  readonly visibility: ShareVisibility;
  readonly allowedEmails: string[];
  readonly expiresAt?: string | null;
}

export interface CreateShareLinkResponse {
  readonly token: string;
}

export interface GetSharedNoteResponse {
  readonly noteReadOnly: Note;
  readonly summaries: AISummary[];
}

// ─── Error ───

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
