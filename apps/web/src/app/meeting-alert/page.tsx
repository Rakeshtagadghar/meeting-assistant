"use client";

import { useEffect, useState } from "react";

type MeetingDetectedPayload = {
  title: string;
  subtitle: string;
  actionLabel: string;
  meetingSessionId: string;
  autoStartOnAction: boolean;
  route?: string;
};

export default function MeetingAlertPage() {
  const [payload, setPayload] = useState<MeetingDetectedPayload>({
    title: "Meeting detected",
    subtitle: "Online meeting",
    actionLabel: "Take Notes",
    meetingSessionId: "",
    autoStartOnAction: true,
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const bind = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<MeetingDetectedPayload>(
          "meeting-detected",
          (event) => {
            setPayload(event.payload);
          },
        );
      } catch {
        // Non-tauri env.
      }
    };

    void bind();

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!payload.meetingSessionId) {
      return;
    }

    const timeout = setTimeout(() => {
      void handleDismiss();
    }, 5_000);

    return () => {
      clearTimeout(timeout);
    };
    // Re-arm auto-dismiss each time a new meeting alert payload arrives.
  }, [payload.meetingSessionId]);

  const handleTakeNotes = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_meeting_capture", {
        meetingSessionId: payload.meetingSessionId,
      });
    } catch {
      // no-op
    }
  };

  const handleDismiss = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("dismiss_meeting_alert");
    } catch {
      // no-op
    }
  };

  return (
    <div className="flex h-screen w-screen items-start justify-end bg-transparent p-2">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
        <div className="h-8 w-1 rounded-full bg-gray-300" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800">
            {payload.title}
          </p>
          <p className="truncate text-xs text-gray-500">{payload.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleTakeNotes}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          {payload.actionLabel}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
