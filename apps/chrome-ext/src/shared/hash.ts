const SALT = "golden-minutes-ext-v1";

export async function hashMeetingUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url + SALT);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
