import { clsx } from "clsx";

interface QuickActionsProps {
  meetingDetected: boolean;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSnooze: () => void;
  onOpenSettings: () => void;
  onOpenWeb: () => void;
}

export function QuickActions({
  meetingDetected,
  isRecording,
  onStartRecording,
  onStopRecording,
  onSnooze,
  onOpenSettings,
  onOpenWeb,
}: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {isRecording ? (
        <button
          onClick={onStopRecording}
          className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0 flex items-center justify-center gap-2"
        >
          <div className="w-3 h-3 rounded-sm bg-white" />
          Stop Recording
        </button>
      ) : (
        <button
          onClick={onStartRecording}
          disabled={!meetingDetected}
          className={clsx(
            "w-full py-3 px-4 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2",
            meetingDetected
              ? "bg-gradient-to-r from-[#d4a843] to-[#c49a3a] text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0"
              : "bg-gray-200 text-gray-400 cursor-not-allowed",
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="5" />
          </svg>
          Start Recording
        </button>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSnooze}
          className="flex-1 py-2.5 px-3 bg-white/60 backdrop-blur-sm text-gray-600 text-sm font-medium rounded-xl hover:bg-white/80 transition-all duration-200 border border-white/50"
        >
          Snooze 30m
        </button>
        <button
          onClick={onOpenWeb}
          className="flex-1 py-2.5 px-3 bg-white/60 backdrop-blur-sm text-gray-600 text-sm font-medium rounded-xl hover:bg-white/80 transition-all duration-200 border border-white/50"
        >
          Open App
        </button>
      </div>

      <button
        onClick={onOpenSettings}
        className="w-full py-2 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
      >
        Settings
      </button>
    </div>
  );
}
