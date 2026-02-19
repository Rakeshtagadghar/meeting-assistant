import type { Settings } from "./types";
import { DEFAULT_SETTINGS } from "./constants";

export function mergeSettings(partial: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    platformToggles: {
      ...DEFAULT_SETTINGS.platformToggles,
      ...(partial.platformToggles ?? {}),
    },
    denylist: partial.denylist ?? DEFAULT_SETTINGS.denylist,
    allowlist: partial.allowlist ?? DEFAULT_SETTINGS.allowlist,
  };
}

export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];

  if (settings.cooldownMinutes < 1 || settings.cooldownMinutes > 180) {
    errors.push("cooldownMinutes must be between 1 and 180");
  }
  if (settings.snoozeMinutes < 5 || settings.snoozeMinutes > 240) {
    errors.push("snoozeMinutes must be between 5 and 240");
  }
  if (settings.retentionDays < 1 || settings.retentionDays > 30) {
    errors.push("retentionDays must be between 1 and 30");
  }
  if (
    settings.promptMode !== "notification" &&
    settings.promptMode !== "overlay"
  ) {
    errors.push("promptMode must be 'notification' or 'overlay'");
  }
  if (settings.openTarget !== "web" && settings.openTarget !== "desktop") {
    errors.push("openTarget must be 'web' or 'desktop'");
  }

  return errors;
}
