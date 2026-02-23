import { describe, it, expect } from "vitest";
import { mergeSettings, validateSettings } from "./settings-validator";
import { DEFAULT_SETTINGS } from "./constants";
import type { Settings } from "./types";

describe("mergeSettings", () => {
  it("returns defaults when given empty object", () => {
    const result = mergeSettings({});
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("overrides scalar values", () => {
    const result = mergeSettings({ cooldownMinutes: 5, enabled: false });
    expect(result.cooldownMinutes).toBe(5);
    expect(result.enabled).toBe(false);
    expect(result.snoozeMinutes).toBe(DEFAULT_SETTINGS.snoozeMinutes);
  });

  it("merges platform toggles without losing defaults", () => {
    const result = mergeSettings({
      platformToggles: { google_meet: false } as Settings["platformToggles"],
    });
    expect(result.platformToggles.google_meet).toBe(false);
    expect(result.platformToggles.ms_teams).toBe(true);
  });

  it("preserves custom denylist", () => {
    const result = mergeSettings({ denylist: ["example.com"] });
    expect(result.denylist).toEqual(["example.com"]);
  });

  it("maps legacy web open target to extension", () => {
    const result = mergeSettings({ openTarget: "web" });
    expect(result.openTarget).toBe("extension");
  });
});

describe("validateSettings", () => {
  it("returns no errors for valid settings", () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it("catches invalid cooldownMinutes", () => {
    const settings = { ...DEFAULT_SETTINGS, cooldownMinutes: 0 };
    expect(validateSettings(settings)).toContain(
      "cooldownMinutes must be between 1 and 180",
    );
  });

  it("catches invalid snoozeMinutes", () => {
    const settings = { ...DEFAULT_SETTINGS, snoozeMinutes: 3 };
    expect(validateSettings(settings)).toContain(
      "snoozeMinutes must be between 5 and 240",
    );
  });

  it("catches invalid retentionDays", () => {
    const settings = { ...DEFAULT_SETTINGS, retentionDays: 0 };
    expect(validateSettings(settings)).toContain(
      "retentionDays must be between 1 and 30",
    );
  });

  it("catches invalid promptMode", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      promptMode: "invalid" as Settings["promptMode"],
    };
    expect(validateSettings(settings)).toContain(
      "promptMode must be 'notification' or 'overlay'",
    );
  });
});
