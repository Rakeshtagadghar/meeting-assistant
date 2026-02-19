import type {
  Settings,
  CooldownState,
  AuthState,
  RecordingState,
} from "./types";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants";
import { mergeSettings } from "./settings-validator";
import { EMPTY_COOLDOWN_STATE } from "./cooldown";

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const raw = result[STORAGE_KEYS.settings] as Partial<Settings> | undefined;
  return mergeSettings(raw ?? {});
}

export async function saveSettings(
  partial: Partial<Settings>,
): Promise<void> {
  const current = await getSettings();
  const merged = mergeSettings({ ...current, ...partial });
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: merged });
}

export async function getCooldownState(): Promise<CooldownState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.cooldownState);
  return (
    (result[STORAGE_KEYS.cooldownState] as CooldownState | undefined) ??
    EMPTY_COOLDOWN_STATE
  );
}

export async function saveCooldownState(
  state: CooldownState,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.cooldownState]: state });
}

export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.authState);
  return (
    (result[STORAGE_KEYS.authState] as AuthState | undefined) ?? {
      token: null,
      email: null,
      expiresAt: null,
    }
  );
}

export async function saveAuthState(state: AuthState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.authState]: state });
}

export async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.authState);
}

export async function getRecordingState(): Promise<RecordingState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.recordingState);
  return (
    (result[STORAGE_KEYS.recordingState] as RecordingState | undefined) ?? {
      isRecording: false,
      tabId: null,
      sessionId: null,
      startedAt: null,
    }
  );
}

export async function saveRecordingState(
  state: RecordingState,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.recordingState]: state });
}

export async function isAuthenticated(): Promise<boolean> {
  const auth = await getAuthState();
  if (!auth.token || !auth.expiresAt) return false;
  return Date.now() < auth.expiresAt;
}
