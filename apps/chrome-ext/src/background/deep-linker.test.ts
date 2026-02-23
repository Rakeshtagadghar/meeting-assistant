import { describe, expect, it } from "vitest";
import { buildDeepLink } from "./deep-linker";

describe("buildDeepLink", () => {
  it("maps legacy /start web URL to /quick-note", () => {
    const url = buildDeepLink({
      target: "web",
      platform: "google_meet",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      ts: 1771544639452,
      desktopScheme: "goldenminutes://start",
      webUrl: "https://www.goldenminutes.co.uk/start",
    });

    expect(url.startsWith("https://www.goldenminutes.co.uk/quick-note?")).toBe(
      true,
    );
    expect(url).toContain("platform=google_meet");
    expect(url).toContain("source=chrome_ext");
    expect(url).toContain("consent=1");
  });

  it("appends query params with '&' when web URL already has query", () => {
    const url = buildDeepLink({
      target: "web",
      platform: "google_meet",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      ts: 1771544639452,
      desktopScheme: "goldenminutes://start",
      webUrl: "https://www.goldenminutes.co.uk/quick-note?foo=bar",
    });

    expect(url).toContain("foo=bar&platform=google_meet");
  });

  it("returns desktop deep link when target is desktop", () => {
    const url = buildDeepLink({
      target: "desktop",
      platform: "google_meet",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      ts: 1771544639452,
      desktopScheme: "goldenminutes://start",
      webUrl: "https://www.goldenminutes.co.uk/quick-note",
    });

    expect(url.startsWith("goldenminutes://start?")).toBe(true);
    expect(url).toContain("platform=google_meet");
  });
});
