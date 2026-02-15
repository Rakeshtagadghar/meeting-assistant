export interface ConsentResult {
  confirmed: boolean;
  text: string | null;
}

export interface ConsentRecord {
  userId: string;
  meetingSessionId: string;
  timestamp: string;
  captureMode: CaptureMode;
}

export type CaptureMode = "mic_only" | "system_only" | "mixed";

const DEFAULT_CONSENT_TEXT =
  "Always get consent before transcribing others. Confirm you have permission to record and transcribe this meeting.";

export function validateConsent(
  confirmed: boolean,
  text: string | null,
): ConsentResult {
  if (!confirmed) {
    return { confirmed: false, text: null };
  }

  return {
    confirmed: true,
    text: text ?? DEFAULT_CONSENT_TEXT,
  };
}

export function buildConsentRecord(input: {
  userId: string;
  meetingSessionId: string;
  captureMode: CaptureMode;
  timestamp?: Date;
}): ConsentRecord {
  return {
    userId: input.userId,
    meetingSessionId: input.meetingSessionId,
    captureMode: input.captureMode,
    timestamp: (input.timestamp ?? new Date()).toISOString(),
  };
}
