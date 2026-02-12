"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePostHog } from "posthog-js/react";
import { hashEmail } from "./events";

/** Identifies the user to PostHog on login and resets on logout. */
export function PostHogIdentify() {
  const { data: session, status } = useSession();
  const posthog = usePostHog();
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;

    if (status === "authenticated" && session?.user) {
      // @ts-expect-error -- id is injected by auth callbacks
      const userId = session.user.id as string | undefined;
      if (!userId || identifiedRef.current === userId) return;

      identifiedRef.current = userId;

      const email = session.user.email;
      if (email) {
        hashEmail(email).then((emailHash) => {
          posthog.identify(userId, { email_hash: emailHash });
        });
      } else {
        posthog.identify(userId);
      }
    } else if (status === "unauthenticated" && identifiedRef.current) {
      identifiedRef.current = null;
      posthog.reset();
    }
  }, [session, status, posthog]);

  return null;
}
