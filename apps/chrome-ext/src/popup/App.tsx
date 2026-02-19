import { useState, useEffect, useCallback } from "react";
import { SignInGate } from "./components/SignInGate";
import { StatusCard } from "./components/StatusCard";
import { QuickActions } from "./components/QuickActions";
import { ToggleSwitch } from "./components/ToggleSwitch";
import type {
  Settings,
  RecordingState,
  TabMeetingState,
} from "@/shared/types";
import {
  getSettings,
  saveSettings,
  isAuthenticated,
  getRecordingState,
} from "@/shared/storage";
import { buildSignInUrl, buildSessionUrl } from "@/shared/auth";
import { DEFAULT_WEB_BASE_URL } from "@/shared/constants";

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const [tabState, setTabState] = useState<TabMeetingState | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function init() {
      const [auth, s, rec] = await Promise.all([
        isAuthenticated(),
        getSettings(),
        getRecordingState(),
      ]);
      setAuthed(auth);
      setSettings(s);
      setRecording(rec);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        try {
          const state = await chrome.runtime.sendMessage({
            type: "GET_STATUS",
            payload: { tabId: tab.id },
          });
          if (state) setTabState(state as TabMeetingState);
        } catch {
          // Background may not be ready
        }
      }
    }
    void init();
  }, []);

  useEffect(() => {
    if (!recording?.isRecording || !recording.startedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recording.startedAt!) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      setRecordingDuration(
        `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [recording?.isRecording, recording?.startedAt]);

  const handleSignIn = useCallback(() => {
    chrome.tabs.create({ url: buildSignInUrl() });
  }, []);

  const handleToggle = useCallback(async (enabled: boolean) => {
    await saveSettings({ enabled });
    setSettings((prev) => (prev ? { ...prev, enabled } : prev));
  }, []);

  const handleStartRecording = useCallback(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url) return;

    await chrome.runtime.sendMessage({
      type: "USER_DECISION",
      payload: {
        decision: "start",
        tabId: tab.id,
        url: tab.url,
        ts: Date.now(),
      },
    });

    const rec = await getRecordingState();
    setRecording(rec);
  }, []);

  const handleStopRecording = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
    setRecording({
      isRecording: false,
      tabId: null,
      sessionId: null,
      startedAt: null,
    });
    setRecordingDuration(null);
  }, []);

  const handleSnooze = useCallback(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url) return;
    await chrome.runtime.sendMessage({
      type: "USER_DECISION",
      payload: {
        decision: "snooze",
        tabId: tab.id,
        url: tab.url,
        ts: Date.now(),
      },
    });
    globalThis.close();
  }, []);

  const handleOpenSettings = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleOpenWeb = useCallback(() => {
    chrome.tabs.create({ url: DEFAULT_WEB_BASE_URL });
  }, []);

  const handleViewTranscript = useCallback(() => {
    if (recording?.sessionId) {
      chrome.tabs.create({ url: buildSessionUrl(recording.sessionId) });
    }
  }, [recording?.sessionId]);

  if (authed === null) {
    return (
      <div className="w-[380px] min-h-[480px] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <SignInGate onSignIn={handleSignIn} />;
  }

  const meetingDetected =
    tabState?.state === "MEETING_CANDIDATE" ||
    tabState?.state === "PROMPT_SHOWN" ||
    tabState?.state === "USER_ACCEPTED" ||
    tabState?.state === "RUNNING";

  const isRec = recording?.isRecording ?? false;

  return (
    <div className="w-[380px] min-h-[480px] bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-md shadow-purple-500/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
            <path
              d="M12 6v6l4 2"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">
            Golden Minutes
          </h1>
          <p className="text-xs text-gray-400">Meeting assistant</p>
        </div>
        {isRec && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-600">REC</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        {settings && (
          <ToggleSwitch
            enabled={settings.enabled}
            onChange={handleToggle}
            label="Meeting detection"
            description="Detect meetings and prompt to record"
          />
        )}

        <StatusCard
          meetingDetected={meetingDetected}
          platform={tabState?.candidate?.platform ?? null}
          isRecording={isRec}
          recordingDuration={recordingDuration}
          onViewTranscript={isRec ? handleViewTranscript : undefined}
        />

        <QuickActions
          meetingDetected={meetingDetected}
          isRecording={isRec}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onSnooze={handleSnooze}
          onOpenSettings={handleOpenSettings}
          onOpenWeb={handleOpenWeb}
        />
      </div>
    </div>
  );
}
