import type { RecordingState } from "@/shared/types";
import { getRecordingState, saveRecordingState, getAuthState } from "@/shared/storage";
import { DEFAULT_WEB_BASE_URL } from "@/shared/constants";

let offscreenCreated = false;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenCreated) return;

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("src/offscreen/offscreen.html"),
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Capture microphone audio for meeting transcription",
  });

  offscreenCreated = true;
}

async function closeOffscreenDocument(): Promise<void> {
  if (!offscreenCreated) return;

  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // Already closed
  }
  offscreenCreated = false;
}

export async function startRecording(
  tabId: number,
  sessionId: string,
): Promise<void> {
  const auth = await getAuthState();
  if (!auth.token) {
    throw new Error("Not authenticated");
  }

  await ensureOffscreenDocument();

  await chrome.runtime.sendMessage({
    type: "START_RECORDING",
    payload: {
      sessionId,
      apiBaseUrl: DEFAULT_WEB_BASE_URL,
      authToken: auth.token,
    },
  });

  const state: RecordingState = {
    isRecording: true,
    tabId,
    sessionId,
    startedAt: Date.now(),
  };
  await saveRecordingState(state);

  chrome.action.setBadgeText({ text: "REC" });
  chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
}

export async function stopRecording(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
  } catch {
    // Offscreen may already be closed
  }

  await closeOffscreenDocument();

  const state: RecordingState = {
    isRecording: false,
    tabId: null,
    sessionId: null,
    startedAt: null,
  };
  await saveRecordingState(state);

  chrome.action.setBadgeText({ text: "" });
}

export async function getCurrentRecordingState(): Promise<RecordingState> {
  return getRecordingState();
}
