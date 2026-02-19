import type { MeetingPlatform } from "./types";

export interface ClassificationResult {
  platform: MeetingPlatform;
  confidence: number;
  signals: string[];
}

interface PlatformRule {
  platform: MeetingPlatform;
  test: (url: URL) => { match: boolean; confidence: number; signal: string };
}

const GOOGLE_MEET_CODE_REGEX = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

const rules: PlatformRule[] = [
  {
    platform: "google_meet",
    test: (url) => {
      if (url.hostname !== "meet.google.com") {
        return { match: false, confidence: 0, signal: "" };
      }
      const hasCode = GOOGLE_MEET_CODE_REGEX.test(url.pathname);
      return {
        match: true,
        confidence: hasCode ? 0.9 : 0.5,
        signal: hasCode ? "url_pattern_with_code" : "url_hostname_only",
      };
    },
  },
  {
    platform: "ms_teams",
    test: (url) => {
      if (!url.hostname.includes("teams.microsoft.com")) {
        return { match: false, confidence: 0, signal: "" };
      }
      const isMeeting =
        url.pathname.includes("/l/meetup-join/") ||
        url.pathname.includes("/meeting");
      return {
        match: true,
        confidence: isMeeting ? 0.9 : 0.6,
        signal: isMeeting ? "url_meeting_path" : "url_hostname_only",
      };
    },
  },
  {
    platform: "zoom_web",
    test: (url) => {
      if (
        !url.hostname.includes("zoom.us") &&
        !url.hostname.includes("zoom.com")
      ) {
        return { match: false, confidence: 0, signal: "" };
      }
      const isMeeting =
        url.pathname.startsWith("/wc/") || url.pathname.startsWith("/j/");
      return {
        match: isMeeting,
        confidence: isMeeting ? 0.85 : 0,
        signal: isMeeting ? "url_meeting_path" : "",
      };
    },
  },
  {
    platform: "webex",
    test: (url) => {
      if (!url.hostname.includes("webex.com")) {
        return { match: false, confidence: 0, signal: "" };
      }
      const isMeeting = url.pathname.includes("/meet/");
      return {
        match: true,
        confidence: isMeeting ? 0.8 : 0.5,
        signal: isMeeting ? "url_meet_path" : "url_hostname_only",
      };
    },
  },
];

export function classifyUrl(urlString: string): ClassificationResult | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  for (const rule of rules) {
    const result = rule.test(url);
    if (result.match) {
      return {
        platform: rule.platform,
        confidence: result.confidence,
        signals: [result.signal],
      };
    }
  }

  return null;
}

export function extractHostname(urlString: string): string | null {
  try {
    return new URL(urlString).hostname;
  } catch {
    return null;
  }
}
