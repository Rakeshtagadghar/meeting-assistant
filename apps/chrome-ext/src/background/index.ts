/* eslint-disable no-console */
import { startTabTracking } from "./tab-tracker";
import {
  detectMeeting,
  getTabState,
  transitionTab,
  removeTabState,
} from "./meeting-detector";
import {
  initNotifications,
  showMeetingNotification,
  clearMeetingNotification,
} from "./notification-manager";
import { buildDeepLink, openDeepLink, openExtensionPopup } from "./deep-linker";
import { initAuthListener, checkAuth } from "./auth-manager";
import { startRecording, stopRecording } from "./recording-manager";
import {
  getSettings,
  getCooldownState,
  saveCooldownState,
  saveSettings,
} from "@/shared/storage";
import { applySnooze } from "@/shared/cooldown";
import { extractHostname } from "@/shared/url-classifier";
import { onMessage, sendTabMessage } from "@/shared/messaging";

console.log("[Golden Minutes] Service worker loaded");

initAuthListener();

initNotifications({
  onStart: (tabId, url) => void handleStart(tabId, url),
  onSnooze: (tabId, url) => void handleSnooze(tabId, url),
  onDenySite: (tabId, url) => void handleDenySite(tabId, url),
});

startTabTracking(async (tabId, url) => {
  const isAuthed = await checkAuth();
  if (!isAuthed) return;

  const result = await detectMeeting(tabId, url);
  if (!result.shouldPrompt || !result.candidate) return;

  const settings = await getSettings();

  if (settings.promptMode === "overlay") {
    try {
      await sendTabMessage(tabId, {
        type: "SHOW_PROMPT",
        payload: {
          mode: "overlay",
          platform: result.candidate.platform,
          ts: result.candidate.ts,
        },
      });
      transitionTab(tabId, "prompt_displayed");
    } catch {
      showMeetingNotification(tabId, url, result.candidate.platform);
      transitionTab(tabId, "prompt_displayed");
    }
  } else {
    showMeetingNotification(tabId, url, result.candidate.platform);
    transitionTab(tabId, "prompt_displayed");
  }
});

onMessage((message, _sender, sendResponse) => {
  if (message.type === "USER_DECISION") {
    const { decision, tabId, url } = message.payload;

    switch (decision) {
      case "start":
        handleStart(tabId, url);
        break;
      case "snooze":
        handleSnooze(tabId, url);
        break;
      case "deny_site":
        handleDenySite(tabId, url);
        break;
      case "dismiss":
        transitionTab(tabId, "user_dismiss");
        break;
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_STATUS") {
    const state = getTabState(message.payload.tabId);
    sendResponse(state);
    return;
  }

  if (message.type === "TRANSCRIPT_CHUNK") {
    console.log("[Golden Minutes] Transcript:", message.payload.text);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  const tabState = getTabState(tabId);
  if (tabState.state === "RUNNING") {
    await stopRecording();
    transitionTab(tabId, "tab_closed_or_navigated");
  }
  clearMeetingNotification(tabId);
  removeTabState(tabId);
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Golden Minutes] Installed:", details.reason);
});

async function handleStart(tabId: number, url: string): Promise<void> {
  transitionTab(tabId, "user_start");

  const sessionId = `gm_${Date.now()}_${tabId}`;
  const tabState = getTabState(tabId);

  try {
    await startRecording(tabId, sessionId);
    transitionTab(tabId, "recording_started");
  } catch (err) {
    console.error(
      "[Golden Minutes] Recording failed, falling back to deep link:",
      err,
    );
    const settings = await getSettings();
    if (settings.openTarget === "desktop") {
      const deepLink = buildDeepLink({
        target: settings.openTarget,
        platform: tabState.candidate?.platform ?? "unknown",
        meetingUrl: url,
        ts: Date.now(),
        desktopScheme: settings.desktopDeepLinkScheme,
        webUrl: settings.webStartUrl,
      });
      await openDeepLink(deepLink);
    } else {
      await openExtensionPopup();
    }
    transitionTab(tabId, "deep_link_opened");
  }
}

async function handleSnooze(tabId: number, _url: string): Promise<void> {
  transitionTab(tabId, "user_snooze_or_deny");
  const settings = await getSettings();
  const cooldownState = await getCooldownState();
  const snoozeDuration = settings.snoozeMinutes * 60 * 1000;
  const updated = applySnooze(cooldownState, snoozeDuration, Date.now());
  await saveCooldownState(updated);
  clearMeetingNotification(tabId);
}

async function handleDenySite(tabId: number, url: string): Promise<void> {
  transitionTab(tabId, "user_snooze_or_deny");
  const hostname = extractHostname(url);
  if (hostname) {
    const settings = await getSettings();
    if (!settings.denylist.includes(hostname)) {
      await saveSettings({
        denylist: [...settings.denylist, hostname],
      });
    }
  }
  clearMeetingNotification(tabId);
}
