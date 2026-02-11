import { describe, it, expect } from "vitest";
import type { ASREvent } from "./asr-events";
import {
  isASRStatusEvent,
  isASRPartialEvent,
  isASRFinalEvent,
} from "./asr-events";

// ─── isASRStatusEvent ───

describe("isASRStatusEvent", () => {
  it("returns true for ASR_STATUS events", () => {
    const event: ASREvent = {
      type: "ASR_STATUS",
      state: "listening",
      message: "Listening...",
    };
    expect(isASRStatusEvent(event)).toBe(true);
  });

  it("returns false for ASR_PARTIAL events", () => {
    const event: ASREvent = {
      type: "ASR_PARTIAL",
      text: "hello",
      tStartMs: 0,
    };
    expect(isASRStatusEvent(event)).toBe(false);
  });

  it("returns false for ASR_FINAL events", () => {
    const event: ASREvent = {
      type: "ASR_FINAL",
      text: "hello world",
      tStartMs: 0,
      tEndMs: 1000,
      speaker: null,
      confidence: null,
      sequence: 0,
    };
    expect(isASRStatusEvent(event)).toBe(false);
  });
});

// ─── isASRPartialEvent ───

describe("isASRPartialEvent", () => {
  it("returns true for ASR_PARTIAL events", () => {
    const event: ASREvent = {
      type: "ASR_PARTIAL",
      text: "hello",
      tStartMs: 500,
    };
    expect(isASRPartialEvent(event)).toBe(true);
  });

  it("returns false for ASR_STATUS events", () => {
    const event: ASREvent = {
      type: "ASR_STATUS",
      state: "ready",
      message: "Ready",
    };
    expect(isASRPartialEvent(event)).toBe(false);
  });
});

// ─── isASRFinalEvent ───

describe("isASRFinalEvent", () => {
  it("returns true for ASR_FINAL events", () => {
    const event: ASREvent = {
      type: "ASR_FINAL",
      text: "hello world",
      tStartMs: 0,
      tEndMs: 2000,
      speaker: "Alice",
      confidence: 0.95,
      sequence: 1,
    };
    expect(isASRFinalEvent(event)).toBe(true);
  });

  it("returns false for ASR_PARTIAL events", () => {
    const event: ASREvent = {
      type: "ASR_PARTIAL",
      text: "hello",
      tStartMs: 0,
    };
    expect(isASRFinalEvent(event)).toBe(false);
  });

  it("allows null speaker and confidence", () => {
    const event: ASREvent = {
      type: "ASR_FINAL",
      text: "some text",
      tStartMs: 0,
      tEndMs: 1000,
      speaker: null,
      confidence: null,
      sequence: 0,
    };
    expect(isASRFinalEvent(event)).toBe(true);
    expect(event.speaker).toBeNull();
    expect(event.confidence).toBeNull();
  });
});
