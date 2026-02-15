import { describe, expect, it } from "vitest";
import {
  buildMeetingDetectedNotification,
  buildQuickNoteRoute,
  detectMeetingProvider,
} from "./notification";

describe("meeting detection notification", () => {
  it("detects zoom from title/process", () => {
    expect(
      detectMeetingProvider({
        windowTitle: "Sprint sync - Zoom Meeting",
        processName: "zoom.exe",
      }),
    ).toBe("zoom");
  });

  it("builds a top-right notification with quick-note autostart route", () => {
    const notification = buildMeetingDetectedNotification(
      "zoom",
      "meeting-123",
    );

    expect(notification.title).toBe("Meeting detected");
    expect(notification.subtitle).toBe("Zoom");
    expect(notification.position).toBe("top-right");
    expect(notification.actionLabel).toBe("Take Notes");
    expect(notification.autoStartOnAction).toBe(true);
    expect(notification.route).toBe(buildQuickNoteRoute("meeting-123"));
    expect(notification.route).toContain("autostart=1");
  });
});
