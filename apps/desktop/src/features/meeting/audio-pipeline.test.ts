import { describe, expect, it } from "vitest";
import {
  mixMeetingAudio,
  resolveCaptureMode,
  resampleTo16kMono,
  TARGET_AUDIO_FORMAT,
} from "./audio-pipeline";

describe("AUD_UT_001 resampleTo16kMono", () => {
  it("outputs 16k mono", () => {
    const stereo48k = new Float32Array(48_000 * 2).fill(0.1);
    const resampled = resampleTo16kMono(stereo48k, 48_000, 2);

    expect(TARGET_AUDIO_FORMAT.sampleRateHz).toBe(16_000);
    expect(TARGET_AUDIO_FORMAT.channels).toBe(1);
    expect(resampled.length).toBe(16_000);
  });
});

describe("AUD_UT_002 mixMeetingAudio", () => {
  it("does not clip and reports limiter", () => {
    const hotMic = new Float32Array([0.9, 0.95, 0.92]);
    const hotSystem = new Float32Array([0.8, 0.85, 0.9]);

    const mixed = mixMeetingAudio(hotMic, hotSystem, {
      micGain: 1.0,
      systemGain: 1.0,
    });

    expect(mixed.maxAmplitude).toBeLessThanOrEqual(1.0);
    expect(mixed.limiterEngaged).toBe(true);
  });
});

describe("AUD_IT_001 loopback + mic capture", () => {
  it("produces a mixed stream containing energy from both", () => {
    const mic = new Float32Array([0.15, 0.12, 0.18, 0.14]);
    const system = new Float32Array([0.25, 0.22, 0.2, 0.23]);

    const mixed = mixMeetingAudio(mic, system);

    expect(mixed.activeSources).toContain("microphone");
    expect(mixed.activeSources).toContain("system_output");
    expect(mixed.samples.some((sample) => sample > 0.3)).toBe(true);
  });
});

describe("capture mode fallback", () => {
  it("falls back to mic only when system output is unavailable", () => {
    const resolved = resolveCaptureMode("mixed", false);

    expect(resolved.mode).toBe("mic_only");
    expect(resolved.warning).toContain("Falling back to microphone only");
  });
});
