"use client";

import Script from "next/script";
import { useCallback, useEffect } from "react";

const CONSENT_KEY = "ainotes-consent";
const CONSENT_EVENT = "ainotes-consent-update";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function useConsentAndGA(measurementId: string) {
  const grantAnalytics = useCallback(() => {
    if (!measurementId || typeof window === "undefined" || !window.gtag) return;
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("config", measurementId);
  }, [measurementId]);

  useEffect(() => {
    const onConsentUpdate = () => grantAnalytics();
    window.addEventListener(CONSENT_EVENT, onConsentUpdate);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentUpdate);
  }, [grantAnalytics]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasConsent = localStorage.getItem(CONSENT_KEY) === "true";
    if (hasConsent && window.gtag) grantAnalytics();
  }, [grantAnalytics]);
}

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useConsentAndGA(measurementId ?? "");

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', {
            'analytics_storage': 'denied'
          });
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
