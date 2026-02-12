"use client";

import { SessionProvider } from "next-auth/react";
import {
  PostHogProvider,
  PostHogPageview,
  PostHogIdentify,
} from "@/lib/posthog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostHogProvider>
        <PostHogPageview />
        <PostHogIdentify />
        {children}
      </PostHogProvider>
    </SessionProvider>
  );
}
