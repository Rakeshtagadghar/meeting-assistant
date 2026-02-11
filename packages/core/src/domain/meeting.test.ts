import { describe, it, expect } from "vitest";
import type { MeetingSession, UUID, ISODateString } from "./types";
import {
  createMeetingSession,
  confirmConsent,
  updateMeetingContext,
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
    platform: "MANUAL",
    title: null,
    participants: [],
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

  it("defaults platform to MANUAL when not provided", () => {
    const session = createMeetingSession(
      {
        noteId: "note-0000-0000-0000-000000000001" as UUID,
        userId: "user-0000-0000-0000-000000000001" as UUID,
        source: "MANUAL",
      },
      "sess-0000-0000-0000-000000000001" as UUID,
      NOW,
    );

    expect(session.platform).toBe("MANUAL");
    expect(session.title).toBeNull();
    expect(session.participants).toEqual([]);
  });

  it("uses provided platform, title, and participants", () => {
    const session = createMeetingSession(
      {
        noteId: "note-0000-0000-0000-000000000001" as UUID,
        userId: "user-0000-0000-0000-000000000001" as UUID,
        source: "MANUAL",
        platform: "GOOGLE_MEET",
        title: "Sprint Planning",
        participants: ["Alice", "Bob"],
      },
      "sess-0000-0000-0000-000000000001" as UUID,
      NOW,
    );

    expect(session.platform).toBe("GOOGLE_MEET");
    expect(session.title).toBe("Sprint Planning");
    expect(session.participants).toEqual(["Alice", "Bob"]);
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

// ─── confirmConsent ───

describe("confirmConsent", () => {
  it("sets consentConfirmed to true and stores consent text", () => {
    const session = makeSession();
    const result = confirmConsent(session, "I agree to recording");

    expect(result.consentConfirmed).toBe(true);
    expect(result.consentText).toBe("I agree to recording");
  });

  it("uses default consent text when null is provided", () => {
    const session = makeSession();
    const result = confirmConsent(session, null);

    expect(result.consentConfirmed).toBe(true);
    expect(result.consentText).toBe("User consented to recording.");
  });

  it("optionally updates title and participants", () => {
    const session = makeSession();
    const result = confirmConsent(session, "I agree", "Sprint Retro", [
      "Alice",
      "Bob",
    ]);

    expect(result.title).toBe("Sprint Retro");
    expect(result.participants).toEqual(["Alice", "Bob"]);
  });

  it("preserves existing title/participants when not provided", () => {
    const session = makeSession({
      title: "Existing Title",
      participants: ["Charlie"],
    });
    const result = confirmConsent(session, "I agree");

    expect(result.title).toBe("Existing Title");
    expect(result.participants).toEqual(["Charlie"]);
  });

  it("does not mutate the original session", () => {
    const session = makeSession();
    confirmConsent(session, "I agree");

    expect(session.consentConfirmed).toBe(false);
    expect(session.consentText).toBeNull();
  });

  it("allows startRecording after confirmConsent", () => {
    const session = makeSession({ status: "IDLE" });
    const consented = confirmConsent(session, "I agree");
    const result = startRecording(consented, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("RECORDING");
    }
  });
});

// ─── updateMeetingContext ───

describe("updateMeetingContext", () => {
  it("updates title when provided", () => {
    const session = makeSession({ title: "Old Title" });
    const result = updateMeetingContext(session, "New Title");

    expect(result.title).toBe("New Title");
  });

  it("updates participants when provided", () => {
    const session = makeSession({ participants: ["Alice"] });
    const result = updateMeetingContext(session, undefined, ["Alice", "Bob"]);

    expect(result.participants).toEqual(["Alice", "Bob"]);
  });

  it("preserves title when not provided", () => {
    const session = makeSession({ title: "Keep This" });
    const result = updateMeetingContext(session, undefined, ["Bob"]);

    expect(result.title).toBe("Keep This");
  });

  it("preserves participants when not provided", () => {
    const session = makeSession({ participants: ["Alice"] });
    const result = updateMeetingContext(session, "New Title");

    expect(result.participants).toEqual(["Alice"]);
  });

  it("does not mutate the original session", () => {
    const session = makeSession({ title: "Original" });
    updateMeetingContext(session, "Changed");

    expect(session.title).toBe("Original");
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
