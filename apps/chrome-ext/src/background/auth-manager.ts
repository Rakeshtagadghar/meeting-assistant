import type { AuthState } from "@/shared/types";
import { getAuthState, saveAuthState, clearAuthState } from "@/shared/storage";
import { buildSignInUrl } from "@/shared/auth";
import { onMessage } from "@/shared/messaging";

export async function checkAuth(): Promise<boolean> {
  const auth = await getAuthState();
  if (!auth.token || !auth.expiresAt) return false;
  return Date.now() < auth.expiresAt;
}

export function openSignIn(): void {
  const url = buildSignInUrl();
  chrome.windows.create({
    url,
    type: "popup",
    width: 520,
    height: 760,
  });
}

export function initAuthListener(): void {
  onMessage((message) => {
    if (message.type === "AUTH_STATE_CHANGED") {
      saveAuthState(message.payload);
    }
  });

  chrome.runtime.onMessageExternal.addListener(
    (
      request: {
        type?: string;
        token?: string;
        email?: string;
        expiresAt?: number;
      },
      _sender,
      sendResponse,
    ) => {
      if (request.type === "GM_AUTH_TOKEN" && request.token) {
        const authState: AuthState = {
          token: request.token,
          email: request.email ?? null,
          expiresAt: request.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
        };
        saveAuthState(authState).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }
    },
  );
}

export async function signOut(): Promise<void> {
  await clearAuthState();
}
