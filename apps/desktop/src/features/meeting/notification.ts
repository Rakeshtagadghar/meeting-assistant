export type MeetingProvider = "teams" | "zoom" | "google_meet" | "unknown";

export interface MeetingNotification {
  title: string;
  subtitle: string;
  actionLabel: string;
  position: "top-right";
  autoStartOnAction: boolean;
  route: string;
}

export function detectMeetingProvider(input: {
  windowTitle?: string | null;
  processName?: string | null;
}): MeetingProvider {
  const haystack =
    `${input.windowTitle ?? ""} ${input.processName ?? ""}`.toLowerCase();

  if (haystack.includes("teams")) {
    return "teams";
  }
  if (haystack.includes("zoom")) {
    return "zoom";
  }
  if (haystack.includes("google meet") || haystack.includes("meet.google")) {
    return "google_meet";
  }

  return "unknown";
}

export function buildMeetingDetectedNotification(
  provider: MeetingProvider,
  meetingSessionId: string,
): MeetingNotification {
  return {
    title: "Meeting detected",
    subtitle: toProviderLabel(provider),
    actionLabel: "Take Notes",
    position: "top-right",
    autoStartOnAction: true,
    route: buildQuickNoteRoute(meetingSessionId),
  };
}

export function buildQuickNoteRoute(meetingSessionId: string): string {
  return `/quick-note?meetingSessionId=${encodeURIComponent(meetingSessionId)}&autostart=1`;
}

function toProviderLabel(provider: MeetingProvider): string {
  switch (provider) {
    case "teams":
      return "Microsoft Teams";
    case "zoom":
      return "Zoom";
    case "google_meet":
      return "Google Meet";
    default:
      return "Online meeting";
  }
}
