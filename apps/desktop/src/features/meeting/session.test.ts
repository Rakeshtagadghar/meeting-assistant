import { describe, expect, it } from "vitest";
import {
  startMeetingFromNotification,
  startMeetingTranscription,
} from "./session";

describe("AUD_UT_003 consent gating", () => {
  it("blocks start when checkbox consent is not granted", () => {
    const result = startMeetingTranscription({
      hasConsent: false,
      captureMode: "mixed",
      userId: "u_1",
      meetingSessionId: "m_1",
      isSystemOutputAvailable: true,
    });

    expect(result.started).toBe(false);
    expect(result.state).toBe("idle");
    expect(result.error).toContain("Consent required");
  });

  it("starts meeting and stores consent metadata", () => {
    const result = startMeetingTranscription({
      hasConsent: true,
      captureMode: "mixed",
      userId: "u_10",
      meetingSessionId: "m_10",
      isSystemOutputAvailable: true,
    });

    expect(result.started).toBe(true);
    expect(result.state).toBe("listening");
    expect(result.consentRecord).toMatchObject({
      userId: "u_10",
      meetingSessionId: "m_10",
      captureMode: "mixed",
    });
  });
});

describe("meeting-detected action", () => {
  it("auto-starts recording when notification action is clicked", () => {
    const result = startMeetingFromNotification({
      hasConsent: true,
      captureMode: "mixed",
      userId: "u_11",
      meetingSessionId: "m_11",
      isSystemOutputAvailable: true,
      route: "/quick-note?meetingSessionId=m_11&autostart=1",
    });

    expect(result.autoStarted).toBe(true);
    expect(result.route).toContain("/quick-note");
    expect(result.route).toContain("autostart=1");
    expect(result.state).toBe("listening");
  });
});
