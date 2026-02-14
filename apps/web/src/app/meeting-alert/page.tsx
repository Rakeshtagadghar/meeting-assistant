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
    <div className="flex h-screen w-screen items-center justify-center bg-transparent p-2">
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
          className="rounded px-1.5 py-1 text-sm text-gray-400 hover:bg-gray-100"
          aria-label="Dismiss"
        >
          ▾
        </button>
      </div>
    </div>
  );
}
