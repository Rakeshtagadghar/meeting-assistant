import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  buildNotionAuthorizeUrl,
  buildNotionRedirectUri,
  createNotionWorkspacePage,
  exchangeNotionCodeForToken,
  getNotionCallbackRedirect,
  refreshNotionToken,
} from "./notion";

const originalClientId = process.env["NOTION_CLIENT_ID"];
const originalClientSecret = process.env["NOTION_CLIENT_SECRET"];
const originalRedirectUri = process.env["NOTION_REDIRECT_URI"];
const originalNextAuthUrl = process.env["NEXTAUTH_URL"];
const originalSiteUrl = process.env["NEXT_PUBLIC_SITE_URL"];

function mockRequest(origin = "http://localhost:3000"): NextRequest {
  return {
    nextUrl: { origin },
  } as unknown as NextRequest;
}

afterEach(() => {
  vi.restoreAllMocks();

  if (originalClientId === undefined) delete process.env["NOTION_CLIENT_ID"];
  else process.env["NOTION_CLIENT_ID"] = originalClientId;

  if (originalClientSecret === undefined)
    delete process.env["NOTION_CLIENT_SECRET"];
  else process.env["NOTION_CLIENT_SECRET"] = originalClientSecret;

  if (originalRedirectUri === undefined)
    delete process.env["NOTION_REDIRECT_URI"];
  else process.env["NOTION_REDIRECT_URI"] = originalRedirectUri;

  if (originalNextAuthUrl === undefined) delete process.env["NEXTAUTH_URL"];
  else process.env["NEXTAUTH_URL"] = originalNextAuthUrl;

  if (originalSiteUrl === undefined) delete process.env["NEXT_PUBLIC_SITE_URL"];
  else process.env["NEXT_PUBLIC_SITE_URL"] = originalSiteUrl;
});

describe("notion oauth helpers", () => {
  it("builds authorize URL with required params", () => {
    process.env["NOTION_CLIENT_ID"] = "client-id";
    process.env["NOTION_CLIENT_SECRET"] = "client-secret";
    process.env["NEXTAUTH_URL"] = "http://localhost:3000";

    const url = buildNotionAuthorizeUrl(mockRequest(), "state-123");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://api.notion.com");
    expect(parsed.pathname).toBe("/v1/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("owner")).toBe("user");
    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/integrations/notion/callback",
    );
  });

  it("uses explicit NOTION_REDIRECT_URI when set", () => {
    process.env["NOTION_REDIRECT_URI"] = "https://example.com/callback";

    expect(buildNotionRedirectUri(mockRequest())).toBe(
      "https://example.com/callback",
    );
  });

  it("builds callback redirect URL to settings", () => {
    process.env["NEXTAUTH_URL"] = "https://app.example.com";

    const url = getNotionCallbackRedirect(mockRequest(), "error", "denied");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://app.example.com");
    expect(parsed.pathname).toBe("/settings");
    expect(parsed.searchParams.get("integration")).toBe("notion");
    expect(parsed.searchParams.get("status")).toBe("error");
    expect(parsed.searchParams.get("reason")).toBe("denied");
  });

  it("exchanges code for token", async () => {
    process.env["NOTION_CLIENT_ID"] = "client-id";
    process.env["NOTION_CLIENT_SECRET"] = "client-secret";
    process.env["NEXTAUTH_URL"] = "http://localhost:3000";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access-token" }),
    } as Response);

    const token = await exchangeNotionCodeForToken(mockRequest(), "code-123");

    expect(token.access_token).toBe("access-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.notion.com/v1/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("refreshes token", async () => {
    process.env["NOTION_CLIENT_ID"] = "client-id";
    process.env["NOTION_CLIENT_SECRET"] = "client-secret";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-r",
      }),
    } as Response);

    const token = await refreshNotionToken("old-refresh");

    expect(token.access_token).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.notion.com/v1/oauth/token",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("creates workspace page", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "page-id", url: "https://notion.so/page-id" }),
    } as Response);

    const page = await createNotionWorkspacePage("token", {
      title: "Meeting Summary",
      children: [],
    });

    expect(page.url).toBe("https://notion.so/page-id");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
