/**
 * Platform-aware ASR Provider factory.
 *
 * Detects the runtime environment and returns the appropriate ASR provider:
 * - Desktop (Tauri): DesktopASRProvider (whisper.cpp via sidecar)
 * - Web + WASM + @huggingface/transformers: WhisperWASMProvider (local Whisper in browser)
 * - Web fallback: WebSpeechProvider (browser Speech API)
 */

import type { ASRProvider } from "@ainotes/core";
import { WhisperWASMProvider } from "./whisper-wasm-provider";
import { WebSpeechProvider } from "./web-speech-provider";

export type ASRProviderType = "whisper-wasm" | "web-speech" | "desktop";

/**
 * Detect if we're running inside Tauri desktop app.
 */
function isTauriDesktop(): boolean {
  return typeof globalThis !== "undefined" && "__TAURI__" in globalThis;
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
 * 1. Desktop (Tauri) → DesktopASRProvider (whisper.cpp sidecar)
 * 2. Web + WASM + @huggingface/transformers → WhisperWASMProvider (local Whisper in browser)
 * 3. Web fallback → WebSpeechProvider (browser Speech API)
 */
export async function createASRProvider(): Promise<ASRProvider> {
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
 * which performs an async check for WASM package availability.
 */
export async function detectASRProviderType(): Promise<ASRProviderType> {
  if (isTauriDesktop()) return "desktop";
  if (isWasmSupported() && (await isWhisperWasmAvailable()))
    return "whisper-wasm";
  return "web-speech";
}
