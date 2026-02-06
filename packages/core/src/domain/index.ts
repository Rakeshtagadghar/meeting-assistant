// ─── Types + Enum value objects ───
export {
  NoteType,
  MeetingSessionSource,
  MeetingSessionStatus,
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
  startRecording,
  pauseRecording,
  stopRecording,
  isValidTransition,
  requiresConsent,
} from "./meeting";

// ─── Transcript ───
export {
  sortChunks,
  mergeAdjacentChunks,
  buildTranscriptText,
  isValidChunkTiming,
  chunksInRange,
} from "./transcript";

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
