import { describe, it, expect } from "vitest";
import { classifyUrl, extractHostname } from "./url-classifier";

describe("classifyUrl", () => {
  describe("Google Meet", () => {
    it("detects a standard meeting URL with high confidence", () => {
      const result = classifyUrl("https://meet.google.com/abc-defg-hij");
      expect(result).not.toBeNull();
      expect(result!.platform).toBe("google_meet");
      expect(result!.confidence).toBe(0.9);
      expect(result!.signals).toContain("url_pattern_with_code");
    });

    it("detects meeting URL with query params", () => {
      const result = classifyUrl(
        "https://meet.google.com/abc-defg-hij?authuser=0",
      );
      expect(result?.platform).toBe("google_meet");
      expect(result?.confidence).toBe(0.9);
    });

    it("detects the homepage with lower confidence", () => {
      const result = classifyUrl("https://meet.google.com/");
      expect(result?.platform).toBe("google_meet");
      expect(result?.confidence).toBe(0.5);
    });

    it("detects the landing page with lower confidence", () => {
      const result = classifyUrl("https://meet.google.com/landing");
      expect(result?.platform).toBe("google_meet");
      expect(result?.confidence).toBe(0.5);
    });
  });

  describe("Microsoft Teams", () => {
    it("detects a meetup-join URL with high confidence", () => {
      const result = classifyUrl(
        "https://teams.microsoft.com/l/meetup-join/abc123",
      );
      expect(result?.platform).toBe("ms_teams");
      expect(result?.confidence).toBe(0.9);
    });

    it("detects a /meeting URL with high confidence", () => {
      const result = classifyUrl(
        "https://teams.microsoft.com/meeting/abc123",
      );
      expect(result?.platform).toBe("ms_teams");
      expect(result?.confidence).toBe(0.9);
    });

    it("detects the Teams homepage with lower confidence", () => {
      const result = classifyUrl("https://teams.microsoft.com/");
      expect(result?.platform).toBe("ms_teams");
      expect(result?.confidence).toBe(0.6);
    });
  });

  describe("Zoom Web", () => {
    it("detects a /wc/ meeting URL", () => {
      const result = classifyUrl("https://zoom.us/wc/123456789");
      expect(result?.platform).toBe("zoom_web");
      expect(result?.confidence).toBe(0.85);
    });

    it("detects a /j/ join URL", () => {
      const result = classifyUrl("https://zoom.us/j/123456789");
      expect(result?.platform).toBe("zoom_web");
      expect(result?.confidence).toBe(0.85);
    });

    it("detects subdomain zoom URLs", () => {
      const result = classifyUrl("https://company.zoom.us/j/123456789");
      expect(result?.platform).toBe("zoom_web");
      expect(result?.confidence).toBe(0.85);
    });

    it("does not match zoom.us homepage", () => {
      const result = classifyUrl("https://zoom.us/");
      expect(result).toBeNull();
    });

    it("does not match zoom.us/pricing", () => {
      const result = classifyUrl("https://zoom.us/pricing");
      expect(result).toBeNull();
    });
  });

  describe("Webex", () => {
    it("detects a /meet/ URL with high confidence", () => {
      const result = classifyUrl("https://webex.com/meet/john.doe");
      expect(result?.platform).toBe("webex");
      expect(result?.confidence).toBe(0.8);
    });

    it("detects subdomain webex URLs", () => {
      const result = classifyUrl(
        "https://company.webex.com/meet/john.doe",
      );
      expect(result?.platform).toBe("webex");
      expect(result?.confidence).toBe(0.8);
    });

    it("detects webex.com homepage with lower confidence", () => {
      const result = classifyUrl("https://webex.com/");
      expect(result?.platform).toBe("webex");
      expect(result?.confidence).toBe(0.5);
    });
  });

  describe("Non-meeting URLs", () => {
    it("returns null for google.com", () => {
      expect(classifyUrl("https://www.google.com/")).toBeNull();
    });

    it("returns null for random URLs", () => {
      expect(classifyUrl("https://example.com/meeting")).toBeNull();
    });

    it("returns null for invalid URLs", () => {
      expect(classifyUrl("not-a-url")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(classifyUrl("")).toBeNull();
    });

    it("returns null for non-http protocols", () => {
      expect(classifyUrl("chrome://extensions")).toBeNull();
    });

    it("returns null for file URLs", () => {
      expect(classifyUrl("file:///tmp/test.html")).toBeNull();
    });

    it("returns null for ftp URLs", () => {
      expect(classifyUrl("ftp://meet.google.com/abc-defg-hij")).toBeNull();
    });
  });
});

describe("extractHostname", () => {
  it("extracts hostname from valid URL", () => {
    expect(extractHostname("https://meet.google.com/abc")).toBe(
      "meet.google.com",
    );
  });

  it("returns null for invalid URL", () => {
    expect(extractHostname("not-a-url")).toBeNull();
  });
});
