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
    // Desktop whisper.cpp doesn't need to download a model in the browser.
    // The model is managed by the Tauri sidecar / local filesystem.
    // We try to resolve the model path if @tauri-apps/api is available,
    // but it's not critical — the sidecar handles model resolution.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathApi: any = await import("@tauri-apps/api/path");
      const resDir: string = await pathApi.resourceDir();
      this.modelPath = await pathApi.join(
        resDir,
        "models",
        `ggml-${modelId}.bin`,
      );
    } catch {
      // @tauri-apps/api not available or not in Tauri context;
      // sidecar will use its own default model path
      this.modelPath = `models/ggml-${modelId}.bin`;
    }

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
    const { listen } = (await import("@tauri-apps/api/event")) as {
      listen: TauriListen;
    };
    this.unlistenFn = (await listen("asr-event", (event) => {
      this.emit(event.payload);
    })) as unknown as () => void;

    // Invoke the start command
    const { invoke } = (await import("@tauri-apps/api/core")) as {
      invoke: TauriInvoke;
    };
    await invoke("start_transcription", {
      modelPath: this.modelPath,
      language: options.language,
    });
  }

  async stopListening(): Promise<void> {
    const { invoke } = (await import("@tauri-apps/api/core")) as {
      invoke: TauriInvoke;
    };
    await invoke("stop_transcription");
    this.cleanup();
  }

  async pauseListening(): Promise<void> {
    const { invoke } = (await import("@tauri-apps/api/core")) as {
      invoke: TauriInvoke;
    };
    await invoke("pause_transcription");
  }

  async resumeListening(): Promise<void> {
    const { invoke } = (await import("@tauri-apps/api/core")) as {
      invoke: TauriInvoke;
    };
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
