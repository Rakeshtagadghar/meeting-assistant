import type { MeetingPlatform } from "@/shared/types";

interface Props {
  platform: MeetingPlatform;
  label: string;
  enabled: boolean;
  onChange: (platform: MeetingPlatform, enabled: boolean) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  google_meet: "G",
  ms_teams: "T",
  zoom_web: "Z",
  webex: "W",
};

export function PlatformToggle({
  platform,
  label,
  enabled,
  onChange,
}: Props) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-sm font-bold text-gray-500 border border-gray-200">
          {PLATFORM_ICONS[platform] ?? "?"}
        </div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={`${label} detection`}
        onClick={() => onChange(platform, !enabled)}
        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${
          enabled
            ? "bg-gradient-to-r from-[#667eea] to-[#764ba2]"
            : "bg-gray-300"
        }`}
        style={{ width: 40, height: 22 }}
      >
        <div
          className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? "translate-x-[20px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
