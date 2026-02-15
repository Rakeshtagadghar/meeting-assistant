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
} from "@ainotes/db";
