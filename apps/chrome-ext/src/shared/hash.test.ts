import { describe, it, expect } from "vitest";
import { hashMeetingUrl } from "./hash";

describe("hashMeetingUrl", () => {
  it("produces a 64-character hex string", async () => {
    const hash = await hashMeetingUrl("https://meet.google.com/abc-defg-hij");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent results for the same input", async () => {
    const url = "https://meet.google.com/abc-defg-hij";
    const h1 = await hashMeetingUrl(url);
    const h2 = await hashMeetingUrl(url);
    expect(h1).toBe(h2);
  });

  it("produces different results for different URLs", async () => {
    const h1 = await hashMeetingUrl("https://meet.google.com/abc-defg-hij");
    const h2 = await hashMeetingUrl("https://meet.google.com/xyz-wxyz-abc");
    expect(h1).not.toBe(h2);
  });
});
