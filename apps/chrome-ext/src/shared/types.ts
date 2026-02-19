export type MeetingPlatform =
  | "google_meet"
  | "ms_teams"
  | "zoom_web"
  | "webex"
  | "unknown";

export type MeetingState =
  | "IDLE"
  | "MEETING_CANDIDATE"
  | "PROMPT_SHOWN"
  | "USER_ACCEPTED"
  | "USER_DECLINED"
  | "RUNNING"
  | "ENDED";

export type PromptMode = "notification" | "overlay";
export type OpenTarget = "web" | "desktop";
export type UserDecision = "start" | "snooze" | "deny_site" | "dismiss";

export interface Settings {
  enabled: boolean;
  promptMode: PromptMode;
  cooldownMinutes: number;
  snoozeMinutes: number;
  platformToggles: Record<MeetingPlatform, boolean>;
  denylist: string[];
  allowlist: string[];
  shareMetadata: boolean;
  storeRecentSessions: boolean;
  retentionDays: number;
  openTarget: OpenTarget;
  desktopDeepLinkScheme: string;
  webStartUrl: string;
}

export interface AuthState {
  token: string | null;
  email: string | null;
  expiresAt: number | null;
}

export interface MeetingCandidate {
  platform: MeetingPlatform;
  tabId: number;
  url: string;
  confidence: number;
  signals: string[];
  ts: number;
}

export interface TabMeetingState {
  tabId: number;
  state: MeetingState;
  candidate: MeetingCandidate | null;
  lastPromptTs: number | null;
  sessionId: string | null;
}

export interface CooldownState {
  lastPromptByUrlHash: Record<string, number>;
  snoozeUntil: number | null;
}

export interface RecordingState {
  isRecording: boolean;
  tabId: number | null;
  sessionId: string | null;
  startedAt: number | null;
}

export interface TranscriptChunk {
  text: string;
  ts: number;
  sessionId: string;
}

export type ExtensionMessage =
  | {
      type: "MEETING_CANDIDATE";
      payload: MeetingCandidate;
    }
  | {
      type: "SHOW_PROMPT";
      payload: { mode: "overlay"; platform: string; ts: number };
    }
  | {
      type: "USER_DECISION";
      payload: {
        decision: UserDecision;
        tabId: number;
        url: string;
        ts: number;
      };
    }
  | {
      type: "OPEN_GOLDEN_MINUTES";
      payload: {
        target: OpenTarget;
        platform: string;
        meetingUrl: string;
        ts: number;
      };
    }
  | { type: "GET_STATUS"; payload: { tabId: number } }
  | { type: "STATUS_RESPONSE"; payload: TabMeetingState }
  | {
      type: "START_RECORDING";
      payload: {
        sessionId: string;
        apiBaseUrl: string;
        authToken: string;
      };
    }
  | { type: "STOP_RECORDING" }
  | {
      type: "TRANSCRIPT_CHUNK";
      payload: TranscriptChunk;
    }
  | { type: "RECORDING_ERROR"; payload: { error: string } }
  | { type: "AUTH_STATE_CHANGED"; payload: AuthState };
