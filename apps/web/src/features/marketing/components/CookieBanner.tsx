"use client";

import { useState, useEffect } from "react";
import { Button, Card } from "@ainotes/ui";
import Link from "next/link";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check local storage for consent
    const consent = localStorage.getItem("ainotes-consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("ainotes-consent", "true");
    setIsVisible(false);
    // In real app, initialize GTM here
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="mx-auto max-w-4xl bg-white p-6 shadow-xl ring-1 ring-gray-900/10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              We care about your privacy
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              We use local storage and cookies to improve your experience. We do
              not track your meeting content. Read our{" "}
              <Link
                href="/privacy"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant="secondary" onClick={() => setIsVisible(false)}>
              Decline
            </Button>
            <Button
              variant="primary"
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={handleAccept}
            >
              Accept All
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
