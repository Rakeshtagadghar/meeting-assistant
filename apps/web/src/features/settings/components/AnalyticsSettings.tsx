"use client";

import { useState, useEffect } from "react";
import { usePostHog } from "posthog-js/react";

const CONSENT_KEY = "Golden Minutes-consent";
const CONSENT_EVENT = "Golden Minutes-consent-update";

export function AnalyticsSettings() {
  const posthog = usePostHog();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    setAnalyticsEnabled(localStorage.getItem(CONSENT_KEY) === "true");
  }, []);

  const handleToggle = () => {
    const newValue = !analyticsEnabled;
    setAnalyticsEnabled(newValue);
    localStorage.setItem(CONSENT_KEY, String(newValue));

    if (newValue) {
      posthog?.opt_in_capturing();
    } else {
      posthog?.opt_out_capturing();
    }

    globalThis.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  };

  const handleResetIdentity = () => {
    posthog?.reset();
  };

  return (
    <div className="glass-card rounded-2xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-text-heading mb-4">
        Analytics
      </h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="font-medium text-text-heading">Usage analytics</p>
            <p className="text-sm text-text-muted">
              Help us improve Golden Minutes by sharing anonymous usage data. We
              never track your meeting content.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={analyticsEnabled}
              onChange={handleToggle}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-text-heading">
              Reset analytics identity
            </p>
            <p className="text-sm text-text-muted">
              Generate a new anonymous identifier. This unlinks your browsing
              history from your current profile.
            </p>
          </div>
          <button
            onClick={handleResetIdentity}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
