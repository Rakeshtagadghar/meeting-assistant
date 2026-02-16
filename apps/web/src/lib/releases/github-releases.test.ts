import { afterEach, describe, expect, it, vi } from "vitest";
import { getLatestWindowsRelease } from "./github-releases";

describe("getLatestWindowsRelease", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses 0.2.0 correctly from windows asset filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          tag_name: "release",
          name: "v0.2.0 - Desktop",
          html_url: "https://github.com/example/release",
          published_at: "2026-02-12T00:06:33Z",
          assets: [
            {
              name: "AI.Notes_0.2.0_x64_en-US.msi",
              browser_download_url: "https://github.com/example/AI.Notes.msi",
            },
          ],
        },
      ],
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await getLatestWindowsRelease();

    expect(result?.version).toBe("0.2.0");
    expect(result?.downloadUrl).toBe("https://github.com/example/AI.Notes.msi");
  });

  it("parses prefixed release names like v0.3.0", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          tag_name: "release",
          name: "v0.3.0",
          html_url: "https://github.com/example/release",
          published_at: "2026-02-16T00:06:33Z",
          assets: [
            {
              name: "GoldenMinutesInstaller.msi",
              browser_download_url:
                "https://github.com/example/GoldenMinutesInstaller.msi",
            },
          ],
        },
      ],
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await getLatestWindowsRelease();

    expect(result?.version).toBe("0.3.0");
  });
});
