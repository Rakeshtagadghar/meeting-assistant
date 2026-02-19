import type { Settings } from "@/shared/types";

interface Props {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
  onClearData: () => void;
}

export function PrivacySection({ settings, onChange, onClearData }: Props) {
  return (
    <div className="space-y-4">
      {/* Share metadata */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Share meeting metadata
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Send basic meeting info (platform, start time) to Golden Minutes
            when you click Start.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={settings.shareMetadata}
          onClick={() => onChange({ shareMetadata: !settings.shareMetadata })}
          className={`relative flex-shrink-0 transition-colors duration-200 rounded-full ${
            settings.shareMetadata
              ? "bg-gradient-to-r from-[#667eea] to-[#764ba2]"
              : "bg-gray-300"
          }`}
          style={{ width: 40, height: 22 }}
        >
          <div
            className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
              settings.shareMetadata
                ? "translate-x-[20px]"
                : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Store recent sessions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Store recent sessions
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Keep hashed meeting identifiers locally to prevent duplicate
            prompts.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={settings.storeRecentSessions}
          onClick={() =>
            onChange({
              storeRecentSessions: !settings.storeRecentSessions,
            })
          }
          className={`relative flex-shrink-0 transition-colors duration-200 rounded-full ${
            settings.storeRecentSessions
              ? "bg-gradient-to-r from-[#667eea] to-[#764ba2]"
              : "bg-gray-300"
          }`}
          style={{ width: 40, height: 22 }}
        >
          <div
            className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
              settings.storeRecentSessions
                ? "translate-x-[20px]"
                : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Retention days */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Data retention: {settings.retentionDays} days
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={settings.retentionDays}
          onChange={(e) =>
            onChange({ retentionDays: parseInt(e.target.value, 10) })
          }
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 day</span>
          <span>30 days</span>
        </div>
      </div>

      {/* Clear data */}
      <button
        onClick={onClearData}
        className="w-full py-2.5 px-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors"
      >
        Clear all local data
      </button>
    </div>
  );
}
