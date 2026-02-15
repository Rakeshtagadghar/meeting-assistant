import type {
  Note,
  AISummary,
  NoteProcessingJob,
  NoteArtifact,
  MeetingSession,
  TranscriptChunk,
  UUID,
  NoteType,
  MeetingSessionSource,
  MeetingSessionStatus,
  MeetingPlatform,
  ShareVisibility,
  IntegrationProvider,
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

// ─── Integrations ───

export interface IntegrationConnection {
  readonly provider: IntegrationProvider;
  readonly expiresAt: string | null;
  readonly metadataJson: JsonValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListIntegrationsResponse {
  readonly integrations: IntegrationConnection[];
}

export interface DisconnectIntegrationRequest {
  readonly provider: IntegrationProvider;
}

export interface DisconnectIntegrationResponse {
  readonly ok: true;
}

export interface ExportIntegrationRequest {
  readonly noteId: UUID;
  readonly provider: IntegrationProvider;
}

export interface ExportIntegrationResponse {
  readonly status: "success" | "error";
  readonly externalUrl: string | null;
  readonly error?: string;
}

// ─── Streaming Summarize SSE Events ───

export interface StreamSummarizeRequest {
  readonly noteId: UUID;
}

export interface StreamTokenEvent {
  readonly token: string;
}

export interface StreamDoneEvent {
  readonly jobId: UUID;
}

export interface StreamErrorEvent {
  readonly message: string;
}

// ─── Meetings ───

export interface CreateMeetingSessionRequest {
  readonly noteId: UUID;
  readonly source?: MeetingSessionSource;
  readonly platform?: MeetingPlatform;
  readonly title?: string;
  readonly participants?: string[];
}

export interface MeetingSessionResponse {
  readonly session: MeetingSession;
}

export interface MeetingSessionWithChunksResponse {
  readonly session: MeetingSession;
  readonly chunks: TranscriptChunk[];
}

export interface UpdateMeetingSessionRequest {
  readonly status?: MeetingSessionStatus;
  readonly title?: string;
  readonly participants?: string[];
}

export interface ConfirmConsentRequest {
  readonly consentText?: string | null;
  readonly title?: string;
  readonly participants?: string[];
}

export interface SaveChunksRequest {
  readonly chunks: Array<{
    readonly sequence: number;
    readonly tStartMs: number;
    readonly tEndMs: number;
    readonly speaker: string | null;
    readonly text: string;
    readonly confidence: number | null;
  }>;
}

export interface SaveChunksResponse {
  readonly saved: number;
}

export interface GetChunksQuery {
  readonly limit?: number;
  readonly afterSequence?: number;
}

export interface GetChunksResponse {
  readonly chunks: TranscriptChunk[];
}

// ─── Error ───

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
