import type {
  MeetingSession,
  MeetingSessionStatus,
  UUID,
  ISODateString,
  CreateMeetingSessionInput,
} from "./types";

type TransitionResult =
  | { readonly ok: true; readonly session: MeetingSession }
  | {
      readonly ok: false;
      readonly error: "consent_required" | "invalid_transition";
    };

const VALID_TRANSITIONS: Record<
  MeetingSessionStatus,
  readonly MeetingSessionStatus[]
> = {
  IDLE: ["RECORDING"],
  RECORDING: ["PAUSED", "STOPPED"],
  PAUSED: ["RECORDING", "STOPPED"],
  STOPPED: [],
};

export function isValidTransition(
  from: MeetingSessionStatus,
  to: MeetingSessionStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function requiresConsent(session: MeetingSession): boolean {
  return !session.consentConfirmed;
}

export function createMeetingSession(
  input: CreateMeetingSessionInput,
  id: UUID,
  now: ISODateString,
): MeetingSession {
  return {
    id,
    userId: input.userId,
    noteId: input.noteId,
    source: input.source,
    startedAt: now,
    endedAt: null,
    consentConfirmed: false,
    consentText: null,
    audioStored: false,
    status: "IDLE",
  };
}

export function startRecording(
  session: MeetingSession,
  _now: ISODateString,
): TransitionResult {
  if (!session.consentConfirmed) {
    return { ok: false, error: "consent_required" };
  }

  if (!isValidTransition(session.status, "RECORDING")) {
    return { ok: false, error: "invalid_transition" };
  }

  return {
    ok: true,
    session: { ...session, status: "RECORDING" },
  };
}

export function pauseRecording(
  session: MeetingSession,
  _now: ISODateString,
): TransitionResult {
  if (!isValidTransition(session.status, "PAUSED")) {
    return { ok: false, error: "invalid_transition" };
  }

  return {
    ok: true,
    session: { ...session, status: "PAUSED" },
  };
}

export function stopRecording(
  session: MeetingSession,
  now: ISODateString,
): TransitionResult {
  if (!isValidTransition(session.status, "STOPPED")) {
    return { ok: false, error: "invalid_transition" };
  }

  return {
    ok: true,
    session: { ...session, status: "STOPPED", endedAt: now },
  };
}
