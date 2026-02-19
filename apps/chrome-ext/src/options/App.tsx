import { useState, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import { SignInGate } from "./components/SignInGate";
import { PromptBehaviorSection } from "./components/PromptBehaviorSection";
import { SitesAndPlatformsSection } from "./components/SitesAndPlatformsSection";
import { PrivacySection } from "./components/PrivacySection";
import { IntegrationsSection } from "./components/IntegrationsSection";
import type { Settings, AuthState } from "@/shared/types";
import {
  getSettings,
  saveSettings,
  getAuthState,
  clearAuthState,
} from "@/shared/storage";
import { buildSignInUrl } from "@/shared/auth";

type SectionKey = "prompt" | "sites" | "privacy" | "integrations";

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [openSection, setOpenSection] = useState<SectionKey | null>("prompt");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function init() {
      const [a, s] = await Promise.all([getAuthState(), getSettings()]);
      setAuth(a);
      setSettings(s);
    }
    void init();
  }, []);

  const isAuthed = auth?.token && auth.expiresAt && Date.now() < auth.expiresAt;

  const handleSignIn = useCallback(() => {
    chrome.tabs.create({ url: buildSignInUrl() });
  }, []);

  const handleSignOut = useCallback(async () => {
    await clearAuthState();
    setAuth({ token: null, email: null, expiresAt: null });
  }, []);

  const handleChange = useCallback(
    async (partial: Partial<Settings>) => {
      if (!settings) return;
      const updated = { ...settings, ...partial };
      if (partial.platformToggles) {
        updated.platformToggles = {
          ...settings.platformToggles,
          ...partial.platformToggles,
        };
      }
      setSettings(updated);
      await saveSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [settings],
  );

  const handleClearData = useCallback(async () => {
    await chrome.storage.local.clear();
    const s = await getSettings();
    setSettings(s);
  }, []);

  const toggleSection = (key: SectionKey) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections: { key: SectionKey; label: string }[] = [
    { key: "prompt", label: "Prompt Behavior" },
    { key: "sites", label: "Sites & Platforms" },
    { key: "privacy", label: "Privacy" },
    { key: "integrations", label: "Integrations" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg shadow-purple-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="white"
                strokeWidth="2"
              />
              <path
                d="M12 6v6l4 2"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Golden Minutes
            </h1>
            <p className="text-sm text-gray-500">Extension Settings</p>
          </div>
          {saved && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full animate-pulse">
              Saved
            </span>
          )}
        </div>

        {/* Auth section */}
        {!isAuthed ? (
          <div className="mb-6">
            <SignInGate onSignIn={handleSignIn} />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white/70 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/50 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white font-semibold text-sm">
                {auth?.email?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {auth?.email ?? "Signed in"}
                </p>
                <p className="text-xs text-gray-400">Authenticated</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

        {/* Settings sections */}
        <div className="space-y-3">
          {sections.map(({ key, label }) => (
            <div
              key={key}
              className="bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-800">
                  {label}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={clsx(
                    "text-gray-400 transition-transform duration-200",
                    openSection === key && "rotate-180",
                  )}
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {openSection === key && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  {key === "prompt" && (
                    <PromptBehaviorSection
                      settings={settings}
                      onChange={handleChange}
                    />
                  )}
                  {key === "sites" && (
                    <SitesAndPlatformsSection
                      settings={settings}
                      onChange={handleChange}
                    />
                  )}
                  {key === "privacy" && (
                    <PrivacySection
                      settings={settings}
                      onChange={handleChange}
                      onClearData={handleClearData}
                    />
                  )}
                  {key === "integrations" && (
                    <IntegrationsSection
                      settings={settings}
                      onChange={handleChange}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Golden Minutes v0.1.0 &middot; No data collected without your
            consent
          </p>
        </div>
      </div>
    </div>
  );
}
