export {
  prisma,
  createNotesRepository,
  createShareLinksRepository,
  createAISummariesRepository,
  createProcessingJobsRepository,
  createArtifactsRepository,
  createMeetingSessionsRepository,
  createTranscriptChunksRepository,
} from "@ainotes/db";

export type {
  NotesRepository,
  ShareLinksRepository,
  AISummariesRepository,
  ProcessingJobsRepository,
  ArtifactsRepository,
  MeetingSessionsRepository,
  TranscriptChunksRepository,
} from "@ainotes/db";
