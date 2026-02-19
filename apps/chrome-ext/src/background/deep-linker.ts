import type { OpenTarget } from "@/shared/types";

export interface DeepLinkParams {
  target: OpenTarget;
  platform: string;
  meetingUrl: string;
  ts: number;
  desktopScheme: string;
  webUrl: string;
}

export function buildDeepLink(params: DeepLinkParams): string {
  const query = new URLSearchParams({
    platform: params.platform,
    meetingUrl: params.meetingUrl,
    ts: String(params.ts),
    source: "chrome_ext",
    consent: "1",
  });

  if (params.target === "desktop") {
    return `${params.desktopScheme}?${query.toString()}`;
  }

  return `${params.webUrl}?${query.toString()}`;
}

export async function openDeepLink(url: string): Promise<void> {
  await chrome.tabs.create({ url });
}
