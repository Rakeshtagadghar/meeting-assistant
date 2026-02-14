"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { Button } from "@ainotes/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to PostHog
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">
        We&apos;ve been notified and are looking into it.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
