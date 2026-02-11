"use client";

import { useState } from "react";

interface EchoCancellationBannerProps {
  show?: boolean;
}

export function EchoCancellationBanner({
  show = true,
}: EchoCancellationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div className="flex items-center gap-2 bg-[#3d5a3e] px-3 py-1.5 text-xs text-white">
      <svg
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="flex-1">Echo cancellation is in beta on Windows</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded p-0.5 hover:bg-white/20"
        aria-label="Dismiss"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
