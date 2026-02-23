import type { CooldownState, Settings } from "./types";

export interface PromptCheck {
  allowed: boolean;
  reason?: string;
}

export function shouldPrompt(
  urlHash: string,
  hostname: string,
  settings: Settings,
  cooldownState: CooldownState,
  now: number,
): PromptCheck {
  if (!settings.enabled) {
    return { allowed: false, reason: "prompts_disabled" };
  }

  if (settings.denylist.includes(hostname)) {
    return { allowed: false, reason: "hostname_denylisted" };
  }

  if (cooldownState.snoozeUntil !== null && now < cooldownState.snoozeUntil) {
    return { allowed: false, reason: "snoozed" };
  }

  const lastPrompt = cooldownState.lastPromptByUrlHash[urlHash];
  if (lastPrompt !== undefined) {
    const cooldownMs = settings.cooldownMinutes * 60 * 1000;
    if (now - lastPrompt < cooldownMs) {
      return { allowed: false, reason: "cooldown_active" };
    }
  }

  return { allowed: true };
}

export function recordPrompt(
  urlHash: string,
  state: CooldownState,
  now: number,
): CooldownState {
  return {
    ...state,
    lastPromptByUrlHash: {
      ...state.lastPromptByUrlHash,
      [urlHash]: now,
    },
  };
}

export function applySnooze(
  state: CooldownState,
  durationMs: number,
  now: number,
): CooldownState {
  return {
    ...state,
    snoozeUntil: now + durationMs,
  };
}

export function clearExpiredCooldowns(
  state: CooldownState,
  maxAgeMs: number,
  now: number,
): CooldownState {
  const filtered: Record<string, number> = {};
  for (const [hash, ts] of Object.entries(state.lastPromptByUrlHash)) {
    if (now - ts < maxAgeMs) {
      filtered[hash] = ts;
    }
  }
  return {
    lastPromptByUrlHash: filtered,
    snoozeUntil:
      state.snoozeUntil !== null && now < state.snoozeUntil
        ? state.snoozeUntil
        : null,
  };
}

export const EMPTY_COOLDOWN_STATE: CooldownState = {
  lastPromptByUrlHash: {},
  snoozeUntil: null,
};
