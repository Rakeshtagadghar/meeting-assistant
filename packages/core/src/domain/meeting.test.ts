import { describe, it, expect } from "vitest";
import type { MeetingSession, UUID, ISODateString } from "./types";
import {
  createMeetingSession,
  startRecording,
  pauseRecording,
  stopRecording,
  isValidTransition,
  requiresConsent,
} from "./meeting";

// ─── Fixture factory ───

function makeSession(overrides?: Partial<MeetingSession>): MeetingSession {
  return {
    id: "sess-0000-0000-0000-000000000001" as UUID,
    userId: "user-0000-0000-0000-000000000001" as UUID,
    noteId: "note-0000-0000-0000-000000000001" as UUID,
    source: "MANUAL",
    startedAt: "2025-06-15T12:00:00.000Z" as ISODateString,
    endedAt: null,
    consentConfirmed: false,
    consentText: null,
    audioStored: false,
    status: "IDLE",
    ...overrides,
  };
}

const NOW = "2025-06-15T12:00:00.000Z" as ISODateString;
const LATER = "2025-06-15T13:00:00.000Z" as ISODateString;

// ─── createMeetingSession ───

describe("createMeetingSession", () => {
  it("creates a session in IDLE status", () => {
    const session = createMeetingSession(
      {
        noteId: "note-0000-0000-0000-000000000001" as UUID,
        userId: "user-0000-0000-0000-000000000001" as UUID,
        source: "MANUAL",
      },
      "sess-0000-0000-0000-000000000001" as UUID,
      NOW,
    );

    expect(session.status).toBe("IDLE");
    expect(session.source).toBe("MANUAL");
    expect(session.consentConfirmed).toBe(false);
    expect(session.audioStored).toBe(false);
    expect(session.endedAt).toBeNull();
  });

  it("preserves the provided id, userId, and noteId", () => {
    const id = "sess-0000-0000-0000-000000000099" as UUID;
    const userId = "user-0000-0000-0000-000000000099" as UUID;
    const noteId = "note-0000-0000-0000-000000000099" as UUID;

    const session = createMeetingSession(
      { noteId, userId, source: "CALENDAR" },
      id,
      NOW,
    );

    expect(session.id).toBe(id);
    expect(session.userId).toBe(userId);
    expect(session.noteId).toBe(noteId);
    expect(session.source).toBe("CALENDAR");
  });

  it("sets startedAt to the provided timestamp", () => {
    const session = createMeetingSession(
      {
        noteId: "note-0000-0000-0000-000000000001" as UUID,
        userId: "user-0000-0000-0000-000000000001" as UUID,
        source: "MANUAL",
      },
      "sess-0000-0000-0000-000000000001" as UUID,
      NOW,
    );

    expect(session.startedAt).toBe(NOW);
  });
});

// ─── startRecording ───

describe("startRecording", () => {
  it("transitions IDLE → RECORDING when consent is confirmed", () => {
    const session = makeSession({
      status: "IDLE",
      consentConfirmed: true,
      consentText: "I agree to recording",
    });
    const result = startRecording(session, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("RECORDING");
    }
  });

  it("transitions PAUSED → RECORDING", () => {
    const session = makeSession({
      status: "PAUSED",
      consentConfirmed: true,
      consentText: "I agree",
    });
    const result = startRecording(session, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("RECORDING");
    }
  });

  it("rejects when consent is not confirmed", () => {
    const session = makeSession({
      status: "IDLE",
      consentConfirmed: false,
    });
    const result = startRecording(session, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("consent_required");
    }
  });

  it("rejects invalid transition from RECORDING", () => {
    const session = makeSession({
      status: "RECORDING",
      consentConfirmed: true,
      consentText: "I agree",
    });
    const result = startRecording(session, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });

  it("rejects invalid transition from STOPPED", () => {
    const session = makeSession({
      status: "STOPPED",
      consentConfirmed: true,
      consentText: "I agree",
    });
    const result = startRecording(session, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });

  it("does not mutate the original session", () => {
    const session = makeSession({
      status: "IDLE",
      consentConfirmed: true,
      consentText: "I agree",
    });
    startRecording(session, NOW);

    expect(session.status).toBe("IDLE");
  });
});

// ─── pauseRecording ───

describe("pauseRecording", () => {
  it("transitions RECORDING → PAUSED", () => {
    const session = makeSession({ status: "RECORDING" });
    const result = pauseRecording(session, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("PAUSED");
    }
  });

  it("rejects invalid transition from IDLE", () => {
    const session = makeSession({ status: "IDLE" });
    const result = pauseRecording(session, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });

  it("rejects invalid transition from STOPPED", () => {
    const session = makeSession({ status: "STOPPED" });
    const result = pauseRecording(session, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });

  it("rejects invalid transition from PAUSED (already paused)", () => {
    const session = makeSession({ status: "PAUSED" });
    const result = pauseRecording(session, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });
});

// ─── stopRecording ───

describe("stopRecording", () => {
  it("transitions RECORDING → STOPPED and sets endedAt", () => {
    const session = makeSession({ status: "RECORDING" });
    const result = stopRecording(session, LATER);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("STOPPED");
      expect(result.session.endedAt).toBe(LATER);
    }
  });

  it("transitions PAUSED → STOPPED and sets endedAt", () => {
    const session = makeSession({ status: "PAUSED" });
    const result = stopRecording(session, LATER);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("STOPPED");
      expect(result.session.endedAt).toBe(LATER);
    }
  });

  it("rejects invalid transition from IDLE", () => {
    const session = makeSession({ status: "IDLE" });
    const result = stopRecording(session, LATER);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });

  it("rejects invalid transition from STOPPED (already stopped)", () => {
    const session = makeSession({ status: "STOPPED" });
    const result = stopRecording(session, LATER);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
  });

  it("does not mutate the original session", () => {
    const session = makeSession({ status: "RECORDING" });
    stopRecording(session, LATER);

    expect(session.status).toBe("RECORDING");
    expect(session.endedAt).toBeNull();
  });
});

// ─── isValidTransition ───

describe("isValidTransition", () => {
  it("allows IDLE → RECORDING", () => {
    expect(isValidTransition("IDLE", "RECORDING")).toBe(true);
  });

  it("allows RECORDING → PAUSED", () => {
    expect(isValidTransition("RECORDING", "PAUSED")).toBe(true);
  });

  it("allows RECORDING → STOPPED", () => {
    expect(isValidTransition("RECORDING", "STOPPED")).toBe(true);
  });

  it("allows PAUSED → RECORDING", () => {
    expect(isValidTransition("PAUSED", "RECORDING")).toBe(true);
  });

  it("allows PAUSED → STOPPED", () => {
    expect(isValidTransition("PAUSED", "STOPPED")).toBe(true);
  });

  it("rejects IDLE → PAUSED", () => {
    expect(isValidTransition("IDLE", "PAUSED")).toBe(false);
  });

  it("rejects IDLE → STOPPED", () => {
    expect(isValidTransition("IDLE", "STOPPED")).toBe(false);
  });

  it("rejects STOPPED → anything", () => {
    expect(isValidTransition("STOPPED", "IDLE")).toBe(false);
    expect(isValidTransition("STOPPED", "RECORDING")).toBe(false);
    expect(isValidTransition("STOPPED", "PAUSED")).toBe(false);
  });

  it("rejects same-state transitions", () => {
    expect(isValidTransition("IDLE", "IDLE")).toBe(false);
    expect(isValidTransition("RECORDING", "RECORDING")).toBe(false);
    expect(isValidTransition("PAUSED", "PAUSED")).toBe(false);
    expect(isValidTransition("STOPPED", "STOPPED")).toBe(false);
  });
});

// ─── requiresConsent ───

describe("requiresConsent", () => {
  it("returns true when consent is not confirmed", () => {
    const session = makeSession({ consentConfirmed: false });
    expect(requiresConsent(session)).toBe(true);
  });

  it("returns false when consent is confirmed", () => {
    const session = makeSession({ consentConfirmed: true });
    expect(requiresConsent(session)).toBe(false);
  });
});
