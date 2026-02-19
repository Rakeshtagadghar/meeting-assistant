import type { Settings, MeetingPlatform } from "@/shared/types";
import { MEETING_PLATFORMS, PLATFORM_LABELS } from "@/shared/constants";
import { PlatformToggle } from "./PlatformToggle";
import { DenylistEditor } from "./DenylistEditor";

interface Props {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

export function SitesAndPlatformsSection({ settings, onChange }: Props) {
  const handlePlatformToggle = (
    platform: MeetingPlatform,
    enabled: boolean,
  ) => {
    onChange({
      platformToggles: {
        ...settings.platformToggles,
        [platform]: enabled,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">
          Enabled platforms
        </p>
        <div className="divide-y divide-gray-100">
          {MEETING_PLATFORMS.map((platform) => (
            <PlatformToggle
              key={platform}
              platform={platform}
              label={PLATFORM_LABELS[platform]}
              enabled={settings.platformToggles[platform]}
              onChange={handlePlatformToggle}
            />
          ))}
        </div>
      </div>

      <DenylistEditor
        label="Blocked sites"
        items={settings.denylist}
        onChange={(denylist) => onChange({ denylist })}
      />

      <DenylistEditor
        label="Always prompt on these sites"
        items={settings.allowlist}
        onChange={(allowlist) => onChange({ allowlist })}
      />
    </div>
  );
}
