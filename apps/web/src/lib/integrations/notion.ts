import type { NextRequest } from "next/server";

export const NOTION_PROVIDER = "NOTION" as const;

const NOTION_AUTH_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";

export interface NotionTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  workspace_id?: string;
  workspace_name?: string;
  workspace_icon?: string;
  bot_id?: string;
  duplicated_template_id?: string;
  owner?: unknown;
}

export interface NotionPageBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

export interface CreateNotionWorkspacePageInput {
  title: string;
  children: NotionPageBlock[];
}

interface NotionEnv {
  clientId: string;
  clientSecret: string;
}

function getNotionEnv(): NotionEnv {
  const clientId = process.env["NOTION_CLIENT_ID"];
  const clientSecret = process.env["NOTION_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    throw new Error("Missing NOTION_CLIENT_ID or NOTION_CLIENT_SECRET");
  }

  return { clientId, clientSecret };
}

function getNotionApiVersion(): string {
  return process.env["NOTION_API_VERSION"] ?? "2022-06-28";
}

function resolveBaseUrl(request: NextRequest): string {
  const configured =
    process.env["NEXTAUTH_URL"] ?? process.env["NEXT_PUBLIC_SITE_URL"];

  if (configured) {
    return new URL(configured).origin;
  }

  return request.nextUrl.origin;
}

export function buildNotionRedirectUri(request: NextRequest): string {
  const configured = process.env["NOTION_REDIRECT_URI"];
  if (configured) {
    return configured;
  }

  const baseUrl = resolveBaseUrl(request);
  return `${baseUrl}/api/integrations/notion/callback`;
}

export function buildNotionAuthorizeUrl(
  request: NextRequest,
  state: string,
): string {
  const { clientId } = getNotionEnv();
  const redirectUri = buildNotionRedirectUri(request);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: redirectUri,
    state,
  });

  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

export async function exchangeNotionCodeForToken(
  request: NextRequest,
  code: string,
): Promise<NotionTokenResponse> {
  const { clientId, clientSecret } = getNotionEnv();
  const redirectUri = buildNotionRedirectUri(request);

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Notion token exchange failed (${response.status}): ${bodyText}`,
    );
  }

  const json = (await response.json()) as NotionTokenResponse;

  if (!json.access_token) {
    throw new Error("Notion token exchange response missing access_token");
  }

  return json;
}

export async function refreshNotionToken(
  refreshToken: string,
): Promise<NotionTokenResponse> {
  const { clientId, clientSecret } = getNotionEnv();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Notion refresh token request failed (${response.status}): ${bodyText}`,
    );
  }

  const json = (await response.json()) as NotionTokenResponse;
  if (!json.access_token) {
    throw new Error("Notion refresh response missing access_token");
  }

  return json;
}

export async function createNotionWorkspacePage(
  accessToken: string,
  input: CreateNotionWorkspacePageInput,
): Promise<{ id: string; url: string }> {
  const response = await fetch(NOTION_PAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": getNotionApiVersion(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { workspace: true },
      properties: {
        title: {
          title: [
            {
              type: "text",
              text: { content: input.title.slice(0, 2000) || "AINotes Export" },
            },
          ],
        },
      },
      children: input.children,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Notion create page failed (${response.status}): ${bodyText}`,
    );
  }

  const page = (await response.json()) as { id: string; url: string };
  if (!page.url) {
    throw new Error("Notion create page response missing URL");
  }

  return page;
}

export function getNotionCallbackRedirect(
  request: NextRequest,
  status: "connected" | "error",
  reason?: string,
): string {
  const baseUrl = resolveBaseUrl(request);
  const params = new URLSearchParams({
    integration: "notion",
    status,
  });

  if (reason) {
    params.set("reason", reason);
  }

  return `${baseUrl}/settings?${params.toString()}`;
}
