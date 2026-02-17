"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { initPostHog, POSTHOG_KEY } from "./client";

const CONSENT_KEY = "ainotes-consent";
const CONSENT_EVENT = "ainotes-consent-update";

function applyPostHogConsent(ph: typeof posthog, consent: string | null) {
  if (consent === "true") {
    ph.set_config({ persistence: "localStorage+cookie" });
    ph.opt_in_capturing();
    return;
  }

  if (consent === "false") {
    ph.set_config({ persistence: "memory" });
    ph.opt_in_capturing();
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const ph = initPostHog();
    if (!ph) return;

    // Apply existing consent state on mount.
    const consent = localStorage.getItem(CONSENT_KEY);
    applyPostHogConsent(ph, consent);
    // null (undecided) -> stays in default opt-out state.

    // React to consent changes from CookieBanner.
    const handleConsentUpdate = () => {
      const updated = localStorage.getItem(CONSENT_KEY);
      applyPostHogConsent(ph, updated);
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
