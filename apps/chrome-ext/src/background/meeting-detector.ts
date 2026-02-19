import type { MeetingCandidate, TabMeetingState, MeetingState } from "@/shared/types";
import { classifyUrl, extractHostname } from "@/shared/url-classifier";
import { hashMeetingUrl } from "@/shared/hash";
import { shouldPrompt, recordPrompt } from "@/shared/cooldown";
import {
  getSettings,
  getCooldownState,
  saveCooldownState,
} from "@/shared/storage";
import { CONFIDENCE_THRESHOLD } from "@/shared/constants";
import { transition } from "./state-machine";

const tabStates = new Map<number, TabMeetingState>();

export function getTabState(tabId: number): TabMeetingState {
  return (
    tabStates.get(tabId) ?? {
      tabId,
      state: "IDLE" as MeetingState,
      candidate: null,
      lastPromptTs: null,
      sessionId: null,
    }
  );
}

export function setTabState(
  tabId: number,
  state: Partial<TabMeetingState>,
): TabMeetingState {
  const current = getTabState(tabId);
  const updated = { ...current, ...state };
  tabStates.set(tabId, updated);
  return updated;
}

export function removeTabState(tabId: number): void {
  tabStates.delete(tabId);
}

export function transitionTab(
  tabId: number,
  trigger: Parameters<typeof transition>[1],
): MeetingState | null {
  const current = getTabState(tabId);
  const next = transition(current.state, trigger);
  if (next) {
    setTabState(tabId, { state: next });
  }
  return next;
}

export interface DetectionResult {
  candidate: MeetingCandidate | null;
  shouldPrompt: boolean;
  reason?: string;
}

export async function detectMeeting(
  tabId: number,
  url: string,
): Promise<DetectionResult> {
  const classification = classifyUrl(url);
  if (!classification) {
    if (tabStates.has(tabId)) {
      const current = getTabState(tabId);
      if (current.state !== "RUNNING") {
        removeTabState(tabId);
      }
    }
    return { candidate: null, shouldPrompt: false, reason: "no_match" };
  }

  if (classification.confidence < CONFIDENCE_THRESHOLD) {
    return {
      candidate: null,
      shouldPrompt: false,
      reason: "low_confidence",
    };
  }

  const settings = await getSettings();

  if (!settings.platformToggles[classification.platform]) {
    return {
      candidate: null,
      shouldPrompt: false,
      reason: "platform_disabled",
    };
  }

  const hostname = extractHostname(url);
  if (!hostname) {
    return { candidate: null, shouldPrompt: false, reason: "invalid_url" };
  }

  const urlHash = await hashMeetingUrl(url);
  const cooldownState = await getCooldownState();
  const now = Date.now();

  const promptCheck = shouldPrompt(
    urlHash,
    hostname,
    settings,
    cooldownState,
    now,
  );

  const candidate: MeetingCandidate = {
    platform: classification.platform,
    tabId,
    url,
    confidence: classification.confidence,
    signals: classification.signals,
    ts: now,
  };

  if (!promptCheck.allowed) {
    return {
      candidate,
      shouldPrompt: false,
      reason: promptCheck.reason,
    };
  }

  const updatedCooldown = recordPrompt(urlHash, cooldownState, now);
  await saveCooldownState(updatedCooldown);

  setTabState(tabId, { candidate });
  transitionTab(tabId, "url_classified");

  return { candidate, shouldPrompt: true };
}
