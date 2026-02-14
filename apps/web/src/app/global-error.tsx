"use client";

import { useEffect } from "react";
import NextError from "next/error";
import { initPostHog } from "@/lib/posthog/client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    const ph = initPostHog();
    if (ph) {
      ph.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={500} />
      </body>
    </html>
  );
}
