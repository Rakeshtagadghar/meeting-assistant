import type { MobileRequiredScreen } from "../mobile-spec";
import { isProtectedMobileScreen } from "../ui/mobile-app-presenter";
import type { MobileAppPresenter } from "../ui/mobile-app-presenter";
import {
  type BuildSignInUrlOptions,
  type MobileAuthClient,
  type MobileAuthSessionResult,
} from "./mobile-auth-client";

export interface MobileAuthBootstrapOptions {
  presenter: MobileAppPresenter;
  authClient: MobileAuthClient;
}

export interface MobileAuthSignInStartOptions extends BuildSignInUrlOptions {
  redirectAfterAuth?: MobileRequiredScreen;
}

export interface MobileAuthCallbackResult {
  status: "authenticated" | "unauthenticated";
  reason: string | null;
}

export class MobileAuthBootstrap {
  private readonly presenter: MobileAppPresenter;
  private readonly authClient: MobileAuthClient;

  constructor(options: MobileAuthBootstrapOptions) {
    this.presenter = options.presenter;
    this.authClient = options.authClient;
  }

  async restoreSessionOnAppStart(): Promise<MobileAuthSessionResult> {
    const session = await this.authClient.getSession();
    this.applySessionResult(session, {
      onUnauthenticated: "guard-active-screen",
    });
    return session;
  }

  startSignIn(options?: MobileAuthSignInStartOptions): string {
    const redirectAfterAuth =
      options?.redirectAfterAuth ?? this.getDefaultRedirectAfterAuth();
    this.presenter.startAuthSignIn(redirectAfterAuth);
    return this.authClient.buildSignInUrl({
      provider: options?.provider,
      callbackUrl:
        options?.callbackUrl ?? this.authClient.getDefaultCallbackUrl(),
    });
  }

  async completeCallback(
    callbackUrl?: string,
  ): Promise<MobileAuthCallbackResult> {
    this.presenter.openAuthCallback();
    const callbackError = extractCallbackError(callbackUrl);
    if (callbackError) {
      this.presenter.startAuthSignIn(
        this.presenter.getViewModel().auth.redirectAfterAuth,
      );
      return {
        status: "unauthenticated",
        reason: callbackError,
      };
    }

    const session = await this.authClient.getSession();
    this.applySessionResult(session, {
      onUnauthenticated: "restart-sign-in",
    });
    return {
      status: session.status,
      reason: session.status === "authenticated" ? null : "session_not_found",
    };
  }

  async signOut(): Promise<void> {
    try {
      await this.authClient.signOut({
        callbackUrl: this.authClient.getDefaultCallbackUrl(),
      });
    } finally {
      this.presenter.signOut();
    }
  }

  private applySessionResult(
    session: MobileAuthSessionResult,
    options: {
      onUnauthenticated: "guard-active-screen" | "restart-sign-in";
    },
  ): void {
    if (session.status === "authenticated") {
      const userLabel = session.user?.name ?? session.user?.email ?? null;
      const currentRoute = this.presenter.getViewModel().auth.route;
      if (currentRoute) {
        this.presenter.completeAuth({ userLabel });
        return;
      }
      this.presenter.setAuthSession({
        status: "authenticated",
        route: null,
        userLabel,
      });
      return;
    }

    if (options.onUnauthenticated === "restart-sign-in") {
      this.presenter.startAuthSignIn(
        this.presenter.getViewModel().auth.redirectAfterAuth,
      );
      return;
    }

    const activeScreen = this.presenter.getViewModel().activeScreen;
    if (isProtectedMobileScreen(activeScreen)) {
      this.presenter.startAuthSignIn(activeScreen);
      return;
    }

    this.presenter.setAuthSession({
      status: "unauthenticated",
      route: null,
      userLabel: null,
    });
  }

  private getDefaultRedirectAfterAuth(): MobileRequiredScreen {
    const activeScreen = this.presenter.getViewModel().activeScreen;
    if (isProtectedMobileScreen(activeScreen)) return activeScreen;
    return "notes";
  }
}

function extractCallbackError(callbackUrl?: string): string | null {
  if (!callbackUrl) return null;
  const parsed = parseAnyUrl(callbackUrl);
  if (!parsed) return null;
  const value = parsed.searchParams.get("error");
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseAnyUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(value, "https://mobile.local");
    } catch {
      return null;
    }
  }
}
