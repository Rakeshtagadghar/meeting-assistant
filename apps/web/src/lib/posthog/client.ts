import posthog from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

export function initPostHog(): typeof posthog | null {
  if (typeof window === "undefined") return null;
  if (!POSTHOG_KEY) return null;
  if (posthog.__loaded) return posthog;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // GDPR: opt out by default; call opt_in_capturing() after consent
    opt_out_capturing_by_default: true,

    persistence: "localStorage+cookie",

    // We track pageviews manually via PostHogPageview component
    capture_pageview: true,
    capture_pageleave: true,

    // Privacy: no session recording in MVP
    disable_session_recording: false,

    autocapture: true,

    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });

  return posthog;
}
