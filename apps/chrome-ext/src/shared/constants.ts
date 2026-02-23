import type { Settings, MeetingPlatform } from "./types";

export const DEBOUNCE_MS = 1500;
export const DEFAULT_COOLDOWN_MINUTES = 10;
export const DEFAULT_SNOOZE_MINUTES = 30;
export const CONFIDENCE_THRESHOLD = 0.7;
export const RECORDING_CHUNK_INTERVAL_MS = 5000;
export const SESSION_RETENTION_DAYS = 7;
export const AUTO_DISMISS_OVERLAY_MS = 15000;

export const STORAGE_KEYS = {
  settings: "gm_ext_settings",
  cooldownState: "gm_ext_cooldown_state",
  recentSessions: "gm_ext_recent_sessions",
  authState: "gm_ext_auth_state",
  tabStates: "gm_ext_tab_states",
  recordingState: "gm_ext_recording_state",
} as const;

export const MEETING_PLATFORMS: MeetingPlatform[] = [
  "google_meet",
  "ms_teams",
  "zoom_web",
  "webex",
];

export const PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  google_meet: "Google Meet",
  ms_teams: "Microsoft Teams",
  zoom_web: "Zoom",
  webex: "Webex",
  unknown: "Unknown",
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  promptMode: "notification",
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
  snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
  platformToggles: {
    google_meet: true,
    ms_teams: true,
    zoom_web: true,
    webex: true,
    unknown: false,
  },
  denylist: [],
  allowlist: [],
  shareMetadata: false,
  storeRecentSessions: true,
  retentionDays: SESSION_RETENTION_DAYS,
  openTarget: "extension",
  desktopDeepLinkScheme: "goldenminutes://start",
  webStartUrl: "https://www.goldenminutes.co.uk/quick-note",
};

export const DEFAULT_WEB_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.goldenminutes.co.uk";
