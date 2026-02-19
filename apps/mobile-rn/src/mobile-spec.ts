export const MOBILE_AUDIO_SPEC = Object.freeze({
  sampleRateHz: 16_000,
  channels: 1,
  encoding: "pcm_s16le",
  frameMs: 20,
  packetMs: 1_000,
});

export const MOBILE_STREAMING_POLICY = Object.freeze({
  mvpBackgroundPolicy: "foregroundOnly",
  maxBufferedMs: 5_000,
  reconnectMaxRetries: 12,
  reconnectBackoffMs: [250, 500, 1_000, 2_000, 4_000, 8_000] as const,
});

export const MOBILE_VAD_POLICY = Object.freeze({
  enabled: true,
  minSpeechMs: 250,
  finalizeOnSilenceMs: 800,
  dropSilenceChunks: true,
  energyThreshold: 0.012,
});

export const MOBILE_PROSODY_POLICY = Object.freeze({
  enabled: true,
  windowSec: 6,
  strideSec: 2,
  minVoicedMs: 800,
  minSnrDb: 10,
  voicedEnergyThreshold: 0.01,
});

export const MOBILE_ANALYSIS_POLICY = Object.freeze({
  cadenceMs: 15_000,
  deltaWindowSec: 15,
  warmupContextSec: 60,
  defaultContextSec: 120,
});

export const MOBILE_REQUIRED_SCREENS = Object.freeze([
  "landing",
  "notes",
  "meeting",
  "chat",
  "settings",
] as const);

export type MobileRequiredScreen = (typeof MOBILE_REQUIRED_SCREENS)[number];

export const MOBILE_AUTH_ROUTES = Object.freeze([
  "auth/sign-in",
  "auth/callback",
] as const);

export type MobileAuthRoute = (typeof MOBILE_AUTH_ROUTES)[number];
