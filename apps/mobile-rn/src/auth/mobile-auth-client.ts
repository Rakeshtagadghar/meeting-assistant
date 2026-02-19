const DEFAULT_AUTH_PROVIDER = "google";
const DEFAULT_AUTH_CALLBACK_PATH = "/mobile/auth/callback";

export interface MobileAuthClientUser {
  id: string | null;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

export interface MobileAuthSessionResult {
  status: "authenticated" | "unauthenticated";
  user: MobileAuthClientUser | null;
  expiresAtIso: string | null;
}

export interface MobileAuthClientOptions {
  baseUrl: string;
  provider?: string;
  callbackPath?: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
}

export interface BuildSignInUrlOptions {
  provider?: string;
  callbackUrl?: string;
}

export interface SignOutOptions {
  callbackUrl?: string;
}

interface NextAuthSessionResponse {
  user?: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    image?: unknown;
  };
  expires?: unknown;
}

interface NextAuthCsrfResponse {
  csrfToken?: unknown;
}

export class MobileAuthClient {
  private readonly baseUrl: string;
  private readonly defaultProvider: string;
  private readonly defaultCallbackUrl: string;
  private readonly headers: Record<string, string>;
  private readonly credentials: RequestCredentials;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MobileAuthClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.defaultProvider = options.provider ?? DEFAULT_AUTH_PROVIDER;
    this.defaultCallbackUrl = toAbsoluteUrl(
      this.baseUrl,
      options.callbackPath ?? DEFAULT_AUTH_CALLBACK_PATH,
    );
    this.headers = { ...(options.headers ?? {}) };
    this.credentials = options.credentials ?? "include";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getDefaultCallbackUrl(): string {
    return this.defaultCallbackUrl;
  }

  buildSignInUrl(options?: BuildSignInUrlOptions): string {
    const provider = options?.provider ?? this.defaultProvider;
    const callbackUrl = options?.callbackUrl ?? this.defaultCallbackUrl;
    const signInUrl = new URL(
      `/api/auth/signin/${encodeURIComponent(provider)}`,
      `${this.baseUrl}/`,
    );
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return signInUrl.toString();
  }

  async getSession(): Promise<MobileAuthSessionResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/session`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...this.headers,
      },
      credentials: this.credentials,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch auth session (status=${String(response.status)}).`,
      );
    }

    const payload = (await response.json()) as NextAuthSessionResponse | null;
    if (!payload?.user) {
      return {
        status: "unauthenticated",
        user: null,
        expiresAtIso: null,
      };
    }

    return {
      status: "authenticated",
      user: {
        id: normalizeId(payload.user.id),
        name: normalizeOptionalString(payload.user.name),
        email: normalizeOptionalString(payload.user.email),
        imageUrl: normalizeOptionalString(payload.user.image),
      },
      expiresAtIso: normalizeOptionalString(payload.expires),
    };
  }

  async signOut(options?: SignOutOptions): Promise<void> {
    const csrfToken = await this.fetchCsrfToken();
    const callbackUrl = options?.callbackUrl ?? this.defaultCallbackUrl;
    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/signout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...this.headers,
      },
      credentials: this.credentials,
      body: new URLSearchParams({
        csrfToken,
        callbackUrl,
        json: "true",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to sign out auth session (status=${String(response.status)}).`,
      );
    }
  }

  private async fetchCsrfToken(): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/csrf`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...this.headers,
      },
      credentials: this.credentials,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch auth CSRF token (status=${String(response.status)}).`,
      );
    }

    const payload = (await response.json()) as NextAuthCsrfResponse;
    const csrfToken = normalizeOptionalString(payload.csrfToken);
    if (!csrfToken) {
      throw new Error("Missing CSRF token in auth response.");
    }
    return csrfToken;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function toAbsoluteUrl(baseUrl: string, value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, `${baseUrl}/`).toString();
  }
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}
