export {
  buildConsentRecord,
  validateConsent,
  type CaptureMode,
  type ConsentRecord,
  type ConsentResult,
} from "./consent";

export {
  mixMeetingAudio,
  resolveCaptureMode,
  resampleTo16kMono,
  TARGET_AUDIO_FORMAT,
  type AudioFormat,
  type AudioPipelineOptions,
  type MixResult,
} from "./audio-pipeline";

export {
  startMeetingTranscription,
  type StartMeetingInput,
  startMeetingFromNotification,
  type StartMeetingResult,
  type NotificationStartInput,
  type NotificationStartResult,
  type TranscriptionState,
} from "./session";

export {
  buildMeetingDetectedNotification,
  buildQuickNoteRoute,
  detectMeetingProvider,
  type MeetingNotification,
  type MeetingProvider,
} from "./notification";
