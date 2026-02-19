import { describe, it, expect } from "vitest";
import {
  shouldPrompt,
  recordPrompt,
  applySnooze,
  clearExpiredCooldowns,
  EMPTY_COOLDOWN_STATE,
} from "./cooldown";
import { DEFAULT_SETTINGS } from "./constants";

const NOW = 1700000000000;
const HASH = "abc123hash";
const HOST = "meet.google.com";

describe("shouldPrompt", () => {
  it("allows prompt when enabled with no cooldown", () => {
    const result = shouldPrompt(
      HASH,
      HOST,
      DEFAULT_SETTINGS,
      EMPTY_COOLDOWN_STATE,
      NOW,
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks when prompts are disabled", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: false };
    const result = shouldPrompt(
      HASH,
      HOST,
      settings,
      EMPTY_COOLDOWN_STATE,
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("prompts_disabled");
  });

  it("blocks when hostname is in denylist", () => {
    const settings = { ...DEFAULT_SETTINGS, denylist: [HOST] };
    const result = shouldPrompt(
      HASH,
      HOST,
      settings,
      EMPTY_COOLDOWN_STATE,
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("hostname_denylisted");
  });

  it("blocks during snooze period", () => {
    const state = { ...EMPTY_COOLDOWN_STATE, snoozeUntil: NOW + 60000 };
    const result = shouldPrompt(HASH, HOST, DEFAULT_SETTINGS, state, NOW);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("snoozed");
  });

  it("allows after snooze expires", () => {
    const state = { ...EMPTY_COOLDOWN_STATE, snoozeUntil: NOW - 1 };
    const result = shouldPrompt(HASH, HOST, DEFAULT_SETTINGS, state, NOW);
    expect(result.allowed).toBe(true);
  });

  it("blocks during cooldown period", () => {
    const state = {
      ...EMPTY_COOLDOWN_STATE,
      lastPromptByUrlHash: { [HASH]: NOW - 60000 },
    };
    const result = shouldPrompt(HASH, HOST, DEFAULT_SETTINGS, state, NOW);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("cooldown_active");
  });

  it("allows after cooldown expires", () => {
    const cooldownMs = DEFAULT_SETTINGS.cooldownMinutes * 60 * 1000;
    const state = {
      ...EMPTY_COOLDOWN_STATE,
      lastPromptByUrlHash: { [HASH]: NOW - cooldownMs - 1 },
    };
    const result = shouldPrompt(HASH, HOST, DEFAULT_SETTINGS, state, NOW);
    expect(result.allowed).toBe(true);
  });

  it("allows for different URL hash even during cooldown", () => {
    const state = {
      ...EMPTY_COOLDOWN_STATE,
      lastPromptByUrlHash: { other_hash: NOW - 60000 },
    };
    const result = shouldPrompt(HASH, HOST, DEFAULT_SETTINGS, state, NOW);
    expect(result.allowed).toBe(true);
  });
});

describe("recordPrompt", () => {
  it("records a new prompt timestamp", () => {
    const result = recordPrompt(HASH, EMPTY_COOLDOWN_STATE, NOW);
    expect(result.lastPromptByUrlHash[HASH]).toBe(NOW);
  });

  it("preserves existing entries", () => {
    const state = {
      ...EMPTY_COOLDOWN_STATE,
      lastPromptByUrlHash: { existing: 123 },
    };
    const result = recordPrompt(HASH, state, NOW);
    expect(result.lastPromptByUrlHash["existing"]).toBe(123);
    expect(result.lastPromptByUrlHash[HASH]).toBe(NOW);
  });

  it("updates existing hash timestamp", () => {
    const state = {
      ...EMPTY_COOLDOWN_STATE,
      lastPromptByUrlHash: { [HASH]: NOW - 100000 },
    };
    const result = recordPrompt(HASH, state, NOW);
    expect(result.lastPromptByUrlHash[HASH]).toBe(NOW);
  });
});

describe("applySnooze", () => {
  it("sets snooze until correct time", () => {
    const result = applySnooze(EMPTY_COOLDOWN_STATE, 1800000, NOW);
    expect(result.snoozeUntil).toBe(NOW + 1800000);
  });
});

describe("clearExpiredCooldowns", () => {
  it("removes entries older than maxAge", () => {
    const state = {
      lastPromptByUrlHash: {
        old: NOW - 100000,
        recent: NOW - 1000,
      },
      snoozeUntil: null,
    };
    const result = clearExpiredCooldowns(state, 50000, NOW);
    expect(result.lastPromptByUrlHash["old"]).toBeUndefined();
    expect(result.lastPromptByUrlHash["recent"]).toBe(NOW - 1000);
  });

  it("clears expired snooze", () => {
    const state = {
      lastPromptByUrlHash: {},
      snoozeUntil: NOW - 1,
    };
    const result = clearExpiredCooldowns(state, 50000, NOW);
    expect(result.snoozeUntil).toBeNull();
  });

  it("preserves active snooze", () => {
    const state = {
      lastPromptByUrlHash: {},
      snoozeUntil: NOW + 100000,
    };
    const result = clearExpiredCooldowns(state, 50000, NOW);
    expect(result.snoozeUntil).toBe(NOW + 100000);
  });
});
