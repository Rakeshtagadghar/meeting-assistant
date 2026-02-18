/**
 * Platform-aware ASR Provider factory.
 *
 * Detects the runtime environment and returns the appropriate ASR provider:
 * - Primary: ElevenLabsRealtimeProvider (server proxy)
 * - Fallback: GroqRealtimeFallbackProvider (whisper-large-v3-turbo)
 * - Desktop fallback (Tauri): DesktopASRProvider (whisper.cpp via sidecar)
 * - Web local fallback: WhisperWASMProvider (local Whisper in browser)
 * - Web fallback: WebSpeechProvider (browser Speech API)
 */

import type { ASRProvider } from "@ainotes/core";
import { ElevenLabsRealtimeProvider } from "./elevenlabs-realtime-provider";
import { GroqRealtimeFallbackProvider } from "./groq-realtime-fallback-provider";
import { WhisperWASMProvider } from "./whisper-wasm-provider";
import { WebSpeechProvider } from "./web-speech-provider";

export type ASRProviderType =
  | "elevenlabs-realtime"
  | "groq-whisper-realtime-fallback"
  | "whisper-cpp"
  | "whisper-wasm"
  | "web-speech";

function elevenLabsDisabledByEnv(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_ELEVENLABS_STT === "1";
}

function groqSttDisabledByEnv(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_GROQ_STT === "1";
}

async function isElevenLabsRealtimeAvailable(): Promise<boolean> {
  if (elevenLabsDisabledByEnv()) return false;
  try {
    const response = await fetch("/api/asr/elevenlabs/available", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return false;
    const data = (await response.json()) as {
      available?: boolean;
      reason?: string;
    };
    if (!data.available && data.reason) {
      // eslint-disable-next-line no-console
      console.warn(`ElevenLabs unavailable: ${data.reason}`);
    }
    return data.available === true;
  } catch {
    return false;
  }
}

async function isGroqRealtimeFallbackAvailable(): Promise<boolean> {
  if (groqSttDisabledByEnv()) return false;
  try {
    const response = await fetch("/api/asr/groq/available", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return false;
    const data = (await response.json()) as {
      available?: boolean;
      reason?: string;
    };
    if (!data.available && data.reason) {
      // eslint-disable-next-line no-console
      console.warn(`Groq unavailable: ${data.reason}`);
    }
    return data.available === true;
  } catch {
    return false;
  }
}

/**
 * Detect if we're running inside Tauri desktop app.
 * Tauri v1 injects __TAURI__, Tauri v2 injects __TAURI_INTERNALS__.
 */
function isTauriDesktop(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    ("__TAURI__" in globalThis || "__TAURI_INTERNALS__" in globalThis)
  );
}

/**
 * Detect if WebAssembly is supported in this browser.
 */
function isWasmSupported(): boolean {
  try {
    return (
      typeof WebAssembly === "object" &&
      typeof WebAssembly.instantiate === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Check if @huggingface/transformers is available for Whisper WASM.
 */
async function isWhisperWasmAvailable(): Promise<boolean> {
  try {
    const mod = await import("@huggingface/transformers");
    return typeof mod.pipeline === "function";
  } catch {
    return false;
  }
}

/**
 * Create the most appropriate ASR provider for the current platform.
 *
 * Priority:
 * 1. ElevenLabsRealtimeProvider
 * 2. GroqRealtimeFallbackProvider (whisper-large-v3-turbo)
 * 3. Desktop (Tauri) -> DesktopASRProvider (whisper.cpp sidecar)
 * 4. Web local fallback -> WhisperWASMProvider
 * 5. Web fallback -> WebSpeechProvider
 */
export async function createASRProvider(): Promise<ASRProvider> {
  if (await isElevenLabsRealtimeAvailable()) {
    return new ElevenLabsRealtimeProvider();
  }

  if (await isGroqRealtimeFallbackAvailable()) {
    return new GroqRealtimeFallbackProvider();
  }

  if (isTauriDesktop()) {
    const { DesktopASRProvider } = await import("./desktop-asr-provider");
    return new DesktopASRProvider();
  }

  if (isWasmSupported() && (await isWhisperWasmAvailable())) {
    return new WhisperWASMProvider();
  }

  // Fallback to Web Speech API
  return new WebSpeechProvider();
}

/**
 * Get the detected provider type without instantiating.
 * Note: This is a sync heuristic. Use createASRProvider() for actual selection
 * which performs async checks for provider availability.
 */
export async function detectASRProviderType(): Promise<ASRProviderType> {
  if (await isElevenLabsRealtimeAvailable()) return "elevenlabs-realtime";
  if (await isGroqRealtimeFallbackAvailable())
    return "groq-whisper-realtime-fallback";
  if (isTauriDesktop()) return "whisper-cpp";
  if (isWasmSupported() && (await isWhisperWasmAvailable()))
    return "whisper-wasm";
  return "web-speech";
}
