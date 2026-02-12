import { PostHog } from "posthog-node";

let serverPostHog: PostHog | null = null;

export function getServerPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

  if (!key) return null;

  if (!serverPostHog) {
    serverPostHog = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return serverPostHog;
}

/**
 * Capture a server-side event. Call from API routes or server actions.
 * Flushes immediately for serverless compatibility.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;

  ph.capture({ distinctId, event, properties });
  await ph.flush();
}
