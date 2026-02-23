import type { OpenTarget } from "@/shared/types";

export interface DeepLinkParams {
  target: OpenTarget;
  platform: string;
  meetingUrl: string;
  ts: number;
  desktopScheme: string;
  webUrl: string;
}

function normalizeWebStartUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname === "/start") {
      parsed.pathname = "/quick-note";
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/\/start(?=$|[?#])/, "/quick-note");
  }
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

  const webUrl = normalizeWebStartUrl(params.webUrl);
  const separator = webUrl.includes("?") ? "&" : "?";
  return `${webUrl}${separator}${query.toString()}`;
}

export async function openDeepLink(url: string): Promise<void> {
  await chrome.tabs.create({ url });
}

export async function openExtensionPopup(): Promise<void> {
  const url = chrome.runtime.getURL("src/popup/index.html");
  await chrome.windows.create({
    url,
    type: "popup",
    width: 420,
    height: 720,
  });
}
