"use client";

import { useEffect, useState } from "react";
import {
  LIVE_ANALYSIS_HEURISTICS_KEY,
  LIVE_ANALYSIS_SETTINGS_EVENT,
} from "../live-analysis-settings";

export function LiveAnalysisSettings() {
  const [useHeuristics, setUseHeuristics] = useState(true);

  useEffect(() => {
    const stored = globalThis.localStorage.getItem(
      LIVE_ANALYSIS_HEURISTICS_KEY,
    );
    if (stored === null) {
      globalThis.localStorage.setItem(LIVE_ANALYSIS_HEURISTICS_KEY, "true");
      setUseHeuristics(true);
      return;
    }
    setUseHeuristics(stored !== "false");
  }, []);

  const handleToggle = () => {
    const next = !useHeuristics;
    setUseHeuristics(next);
    globalThis.localStorage.setItem(LIVE_ANALYSIS_HEURISTICS_KEY, String(next));
    globalThis.dispatchEvent(new CustomEvent(LIVE_ANALYSIS_SETTINGS_EVENT));
  };

  return (
    <div className="glass-card rounded-2xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-text-heading mb-4">
        Live Analysis
      </h2>
      <div className="flex items-center justify-between py-3 border-b border-gray-100">
        <div className="pr-4">
          <p className="font-medium text-text-heading">
            Use heuristics (energy, prosody, dynamics)
          </p>
          <p className="text-sm text-text-muted">
            If disabled, live analysis is transcript-only and ignores tone and
            energy signals.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={useHeuristics}
            onChange={handleToggle}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>
    </div>
  );
}
