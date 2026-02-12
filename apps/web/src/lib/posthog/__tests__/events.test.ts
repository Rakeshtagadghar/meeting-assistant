import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  trackEvent,
  hashEmail,
  durationBucket,
  wordCountBucket,
} from "../events";

const mockCapture = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    __loaded: true,
  },
}));

describe("trackEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures event with correct name and properties", () => {
    trackEvent("note_created", { note_type: "meeting", source: "web" });

    expect(mockCapture).toHaveBeenCalledWith("note_created", {
      note_type: "meeting",
      source: "web",
    });
  });
});

describe("hashEmail", () => {
  it("returns consistent SHA-256 hash", async () => {
    const hash1 = await hashEmail("test@example.com");
    const hash2 = await hashEmail("TEST@example.com");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("produces different hashes for different emails", async () => {
    const hash1 = await hashEmail("alice@example.com");
    const hash2 = await hashEmail("bob@example.com");
    expect(hash1).not.toBe(hash2);
  });
});

describe("durationBucket", () => {
  it("returns correct buckets", () => {
    expect(durationBucket(500)).toBe("<1s");
    expect(durationBucket(3000)).toBe("1-5s");
    expect(durationBucket(10000)).toBe("5-15s");
    expect(durationBucket(20000)).toBe("15-30s");
    expect(durationBucket(45000)).toBe("30-60s");
    expect(durationBucket(120000)).toBe(">60s");
  });
});

describe("wordCountBucket", () => {
  it("returns correct buckets", () => {
    expect(wordCountBucket(50)).toBe("<100");
    expect(wordCountBucket(250)).toBe("100-500");
    expect(wordCountBucket(750)).toBe("500-1k");
    expect(wordCountBucket(3000)).toBe("1k-5k");
    expect(wordCountBucket(10000)).toBe(">5k");
  });
});
