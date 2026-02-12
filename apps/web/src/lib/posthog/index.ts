export { PostHogProvider } from "./PostHogProvider";
export { PostHogPageview } from "./PostHogPageview";
export { PostHogIdentify } from "./PostHogIdentify";
export {
  trackEvent,
  hashEmail,
  durationBucket,
  wordCountBucket,
} from "./events";
// Server-side exports (posthog-node) must NOT go through this barrel.
// Import directly from "@/lib/posthog/server" in API routes / server actions.
