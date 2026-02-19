import type { Settings, OpenTarget } from "@/shared/types";

interface Props {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

export function IntegrationsSection({ settings, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Open target */}
      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">
          Where &ldquo;Start&rdquo; opens Golden Minutes
        </p>
        <div className="flex gap-2">
          {(["web", "desktop"] as OpenTarget[]).map((target) => (
            <button
              key={target}
              onClick={() => onChange({ openTarget: target })}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                settings.openTarget === target
                  ? "bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {target === "web" ? "Web App" : "Desktop App"}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop deep link scheme */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Desktop deep link scheme
        </label>
        <input
          type="text"
          value={settings.desktopDeepLinkScheme}
          onChange={(e) =>
            onChange({ desktopDeepLinkScheme: e.target.value })
          }
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {/* Web start URL */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Web app start URL
        </label>
        <input
          type="text"
          value={settings.webStartUrl}
          onChange={(e) => onChange({ webStartUrl: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>
    </div>
  );
}
