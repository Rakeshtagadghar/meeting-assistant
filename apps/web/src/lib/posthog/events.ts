import posthog from "posthog-js";

// ---- Event name → property type map ----

interface EventMap {
  auth_login_success: { provider: string; is_new_user: boolean };
  note_created: { note_type: string; source: string };
  note_generate_clicked: {
    note_type: string;
    template_selected: string;
    word_count_bucket: string;
  };
  note_generate_completed: {
    duration_ms_bucket: string;
    status: "success" | "error" | "cancelled";
  };
  export_pdf_clicked: { note_type: string };
  export_pdf_completed: {
    duration_ms_bucket: string;
    status: "success" | "error";
  };
  share_email_opened: { provider: string; truncated: boolean };
  meeting_transcription_started: {
    platform: string;
    device: string;
    consent_confirmed: boolean;
  };
  meeting_transcription_stopped: {
    platform: string;
    duration_bucket: string;
  };
}

type EventName = keyof EventMap;

/**
 * Type-safe analytics event capture.
 * Only captures if posthog is loaded and user has opted in.
 */
export function trackEvent<E extends EventName>(
  event: E,
  properties: EventMap[E],
): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;

  posthog.capture(event, properties);
}

/** SHA-256 hash an email for PII-safe identify calls. */
export async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Bucket a duration in ms into a privacy-safe range string. */
export function durationBucket(ms: number): string {
  if (ms < 1000) return "<1s";
  if (ms < 5000) return "1-5s";
  if (ms < 15000) return "5-15s";
  if (ms < 30000) return "15-30s";
  if (ms < 60000) return "30-60s";
  return ">60s";
}

/** Bucket a word count into a privacy-safe range string. */
export function wordCountBucket(count: number): string {
  if (count < 100) return "<100";
  if (count < 500) return "100-500";
  if (count < 1000) return "500-1k";
  if (count < 5000) return "1k-5k";
  return ">5k";
}
