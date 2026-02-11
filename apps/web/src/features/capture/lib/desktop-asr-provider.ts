/**
 * Desktop ASR Provider (whisper.cpp via Tauri sidecar).
 *
 * Implements ASRProvider by calling Tauri commands for audio capture
 * and whisper.cpp transcription, and listening to Tauri events for results.
 */

import type { ASREvent, ASROptions, ASRProvider } from "@ainotes/core";

type EventHandler = (event: ASREvent) => void;

interface TauriInvoke {
  (cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

interface TauriListen {
  (
    event: string,
    handler: (event: { payload: ASREvent }) => void,
  ): Promise<() => void>;
}

export class DesktopASRProvider implements ASRProvider {
  readonly name = "whisper-cpp";
  readonly platform = "desktop" as const;

  private listeners = new Set<EventHandler>();
  private ready = false;
  private unlistenFn: (() => void) | null = null;
  private modelPath = "";

  async initialize(
    modelId: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    // In a full implementation, this would:
    // 1. Check if the model exists in app data dir
    // 2. Download if not present (with progress)
    // For now, assume the model is pre-placed
    const { appDataDir } = await import(
      /* webpackIgnore: true */ "@tauri-apps/api/path"
    );
    const dataDir = await appDataDir();
    this.modelPath = `${dataDir}/models/ggml-${modelId}.bin`;

    onProgress?.(100);
    this.ready = true;

    this.emit({
      type: "ASR_STATUS",
      state: "ready",
      message: `whisper.cpp model ${modelId} ready`,
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  async startListening(options: ASROptions): Promise<void> {
    // Subscribe to Tauri events
    const { listen } = (await import(
      /* webpackIgnore: true */ "@tauri-apps/api/event"
    )) as { listen: TauriListen };
    this.unlistenFn = (await listen("asr-event", (event) => {
      this.emit(event.payload);
    })) as unknown as () => void;

    // Invoke the start command
    const { invoke } = (await import(
      /* webpackIgnore: true */ "@tauri-apps/api/core"
    )) as { invoke: TauriInvoke };
    await invoke("start_transcription", {
      modelPath: this.modelPath,
      language: options.language,
    });
  }

  async stopListening(): Promise<void> {
    const { invoke } = (await import(
      /* webpackIgnore: true */ "@tauri-apps/api/core"
    )) as { invoke: TauriInvoke };
    await invoke("stop_transcription");
    this.cleanup();
  }

  async pauseListening(): Promise<void> {
    const { invoke } = (await import(
      /* webpackIgnore: true */ "@tauri-apps/api/core"
    )) as { invoke: TauriInvoke };
    await invoke("pause_transcription");
  }

  async resumeListening(): Promise<void> {
    const { invoke } = (await import(
      /* webpackIgnore: true */ "@tauri-apps/api/core"
    )) as { invoke: TauriInvoke };
    await invoke("resume_transcription");
  }

  onEvent(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  dispose(): void {
    this.cleanup();
    this.listeners.clear();
    this.ready = false;
  }

  private cleanup(): void {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
  }

  private emit(event: ASREvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch {
        // Don't let handler errors break the pipeline
      }
    }
  }
}
