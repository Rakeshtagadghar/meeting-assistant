"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { initPostHog, POSTHOG_KEY } from "./client";

const CONSENT_KEY = "ainotes-consent";
const CONSENT_EVENT = "ainotes-consent-update";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const ph = initPostHog();
    if (!ph) return;

    // Apply existing consent state on mount
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "true") {
      ph.opt_in_capturing();
    } else if (consent === "false") {
      ph.opt_out_capturing();
    }
    // null (undecided) → stays in default opt-out state

    // React to consent changes from CookieBanner
    const handleConsentUpdate = () => {
      const updated = localStorage.getItem(CONSENT_KEY);
      if (updated === "true") {
        ph.opt_in_capturing();
      } else if (updated === "false") {
        ph.opt_out_capturing();
      }
    };

    globalThis.addEventListener(CONSENT_EVENT, handleConsentUpdate);
    return () =>
      globalThis.removeEventListener(CONSENT_EVENT, handleConsentUpdate);
  }, []);

  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
