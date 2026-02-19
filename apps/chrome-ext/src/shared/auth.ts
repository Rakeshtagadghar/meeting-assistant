import { DEFAULT_WEB_BASE_URL } from "./constants";

export function buildSignInUrl(baseUrl?: string): string {
  const base = baseUrl ?? DEFAULT_WEB_BASE_URL;
  const extId = chrome.runtime.id;
  return `${base}/auth/extension?extId=${encodeURIComponent(extId)}`;
}

export function buildSessionUrl(
  sessionId: string,
  baseUrl?: string,
): string {
  const base = baseUrl ?? DEFAULT_WEB_BASE_URL;
  return `${base}/sessions/${encodeURIComponent(sessionId)}`;
}
