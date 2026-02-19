import type { Settings, PromptMode } from "@/shared/types";

interface Props {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

export function PromptBehaviorSection({ settings, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Enable meeting detection
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Detect and prompt when you join a meeting
          </p>
        </div>
        <button
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => onChange({ enabled: !settings.enabled })}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            settings.enabled
              ? "bg-gradient-to-r from-[#667eea] to-[#764ba2]"
              : "bg-gray-300"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
              settings.enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Prompt mode */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Prompt mode
        </label>
        <select
          value={settings.promptMode}
          onChange={(e) =>
            onChange({ promptMode: e.target.value as PromptMode })
          }
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        >
          <option value="notification">System notification</option>
          <option value="overlay">In-page overlay</option>
        </select>
      </div>

      {/* Cooldown */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Cooldown: {settings.cooldownMinutes} minutes
        </label>
        <input
          type="range"
          min={1}
          max={180}
          value={settings.cooldownMinutes}
          onChange={(e) =>
            onChange({ cooldownMinutes: parseInt(e.target.value, 10) })
          }
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 min</span>
          <span>180 min</span>
        </div>
      </div>

      {/* Snooze */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Snooze duration: {settings.snoozeMinutes} minutes
        </label>
        <input
          type="range"
          min={5}
          max={240}
          value={settings.snoozeMinutes}
          onChange={(e) =>
            onChange({ snoozeMinutes: parseInt(e.target.value, 10) })
          }
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>5 min</span>
          <span>240 min</span>
        </div>
      </div>
    </div>
  );
}
