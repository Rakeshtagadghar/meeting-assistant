import {
  buildConsentRecord,
  type CaptureMode,
  type ConsentRecord,
  validateConsent,
} from "./consent";
import { resolveCaptureMode } from "./audio-pipeline";

export type TranscriptionState =
  | "idle"
  | "listening"
  | "paused"
  | "processing"
  | "completed";

export interface StartMeetingInput {
  hasConsent: boolean;
  consentText?: string | null;
  captureMode: CaptureMode;
  userId: string;
  meetingSessionId: string;
  isSystemOutputAvailable: boolean;
}

export interface StartMeetingResult {
  started: boolean;
  state: TranscriptionState;
  mode: CaptureMode;
  consentRecord: ConsentRecord | null;
  warning: string | null;
  error: string | null;
}

export function startMeetingTranscription(
  input: StartMeetingInput,
): StartMeetingResult {
  const consent = validateConsent(input.hasConsent, input.consentText ?? null);

  if (!consent.confirmed) {
    return {
      started: false,
      state: "idle",
      mode: input.captureMode,
      consentRecord: null,
      warning: null,
      error:
        "Consent required. I have informed participants and have consent to transcribe.",
    };
  }

  const modeResolution = resolveCaptureMode(
    input.captureMode,
    input.isSystemOutputAvailable,
  );

  return {
    started: true,
    state: "listening",
    mode: modeResolution.mode,
    consentRecord: buildConsentRecord({
      userId: input.userId,
      meetingSessionId: input.meetingSessionId,
      captureMode: modeResolution.mode,
    }),
    warning: modeResolution.warning,
    error: null,
  };
}
