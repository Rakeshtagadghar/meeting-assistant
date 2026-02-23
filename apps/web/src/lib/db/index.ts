export {
  prisma,
  createNotesRepository,
  createShareLinksRepository,
  createAISummariesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
  createMeetingSessionsRepository,
  createTranscriptChunksRepository,
  createUserIntegrationsRepository,
  createSummaryArtifactsRepository,
} from "@ainotes/db";

export type {
  NotesRepository,
  ShareLinksRepository,
  AISummariesRepository,
  ProcessingJobsRepository,
  ArtifactsRepository,
  MeetingSessionsRepository,
  TranscriptChunksRepository,
  UserIntegrationsRepository,
  SummaryArtifactsRepository,
} from "@ainotes/db";
