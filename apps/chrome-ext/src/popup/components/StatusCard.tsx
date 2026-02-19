import { clsx } from "clsx";

interface StatusCardProps {
  meetingDetected: boolean;
  platform: string | null;
  isRecording: boolean;
  recordingDuration: string | null;
  onViewTranscript?: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  ms_teams: "Microsoft Teams",
  zoom_web: "Zoom",
  webex: "Webex",
};

export function StatusCard({
  meetingDetected,
  platform,
  isRecording,
  recordingDuration,
  onViewTranscript,
}: StatusCardProps) {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 shadow-lg shadow-purple-500/5 border border-white/50">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={clsx(
              "w-3 h-3 rounded-full",
              isRecording
                ? "bg-red-500 animate-pulse"
                : meetingDetected
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-gray-300",
            )}
          />
          {isRecording && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500/50 animate-ping" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {isRecording
              ? "Recording in progress"
              : meetingDetected
                ? "Meeting detected"
                : "No meeting detected"}
          </p>
          {platform && !isRecording && (
            <p className="text-xs text-gray-500 mt-0.5">
              {PLATFORM_LABELS[platform] ?? platform}
            </p>
          )}
          {isRecording && recordingDuration && (
            <p className="text-xs text-red-500 font-mono mt-0.5">
              {recordingDuration}
            </p>
          )}
        </div>

        {isRecording && onViewTranscript && (
          <button
            onClick={onViewTranscript}
            className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
          >
            View Transcript
          </button>
        )}
      </div>
    </div>
  );
}
