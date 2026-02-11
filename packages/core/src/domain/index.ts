// ─── Types + Enum value objects ───
export {
  NoteType,
  MeetingSessionSource,
  MeetingSessionStatus,
  MeetingPlatform,
  AISummaryKind,
  ShareVisibility,
  ProcessingJobKind,
  ProcessingJobStatus,
  ArtifactType,
  ArtifactStatus,
} from "./types";

export type {
  UUID,
  ISODateString,
  JsonValue,
  User,
  Note,
  MeetingSession,
  TranscriptChunk,
  SummaryPayload,
  ActionItem,
  ActionItemsPayload,
  DecisionsPayload,
  RisksPayload,
  KeyPointsPayload,
  AISummaryByKind,
  AISummary,
  ShareLink,
  NoteProcessingJob,
  NoteArtifact,
  CreateNoteInput,
  UpdateNoteInput,
  CreateShareLinkInput,
  CreateMeetingSessionInput,
  CreateTranscriptChunkInput,
  CreateProcessingJobInput,
  CreateArtifactInput,
} from "./types";

// ─── Note ───
export {
  createNote,
  updateNote,
  softDeleteNote,
  restoreNote,
  serializeNote,
  extractPlainText,
  normalizeTags,
  isValidTag,
  addTag,
  removeTag,
  pinNote,
  unpinNote,
} from "./note";

// ─── Share ───
export {
  normalizeEmail,
  isShareLinkExpired,
  isShareLinkOwner,
  canAccessShareLink,
  createShareLink,
} from "./share";

// ─── Summary ───
export {
  isValidConfidence,
  isSummaryPayload,
  isActionItemsPayload,
  isDecisionsPayload,
  isRisksPayload,
  isKeyPointsPayload,
  validateSummaryPayload,
} from "./summary";

// ─── Meeting ───
export {
  createMeetingSession,
  confirmConsent,
  updateMeetingContext,
  startRecording,
  pauseRecording,
  stopRecording,
  isValidTransition,
  requiresConsent,
} from "./meeting";

// ─── Transcript ───
export {
  createTranscriptChunk,
  sortChunks,
  mergeAdjacentChunks,
  buildTranscriptText,
  isValidChunkTiming,
  chunksInRange,
} from "./transcript";

// ─── ASR Events ───
export type {
  ASRState,
  ASRStatusEvent,
  ASRPartialEvent,
  ASRFinalEvent,
  ASREvent,
  ASROptions,
  ASRProvider,
} from "./asr-events";

export {
  isASRStatusEvent,
  isASRPartialEvent,
  isASRFinalEvent,
} from "./asr-events";

// ─── Processing Job ───
export {
  createProcessingJob,
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
  cancelJob,
  isValidJobTransition,
  isTerminalStatus,
} from "./processing-job";

// ─── Artifact ───
export {
  createArtifact,
  startGeneratingArtifact,
  completeArtifact,
  failArtifact,
  canDownload,
  isExportAllowed,
  isValidArtifactTransition,
} from "./artifact";
