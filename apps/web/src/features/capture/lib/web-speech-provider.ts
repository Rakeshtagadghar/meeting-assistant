/**
 * Web Speech API fallback ASR Provider.
 *
 * Uses the browser's built-in SpeechRecognition API as a fallback
 * when Whisper WASM fails to load or isn't supported.
 *
 * Limitations:
 * - Requires internet (Chrome sends audio to Google servers)
 * - Less accurate than Whisper for many languages
 * - Not available in all browsers (primarily Chrome/Edge)
 */

import type { ASREvent, ASROptions, ASRProvider } from "@ainotes/core";

type EventHandler = (event: ASREvent) => void;

// Type augmentation for the Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = globalThis as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechProvider implements ASRProvider {
  readonly name = "web-speech-api";
  readonly platform = "web" as const;

  private recognition: SpeechRecognitionInstance | null = null;
  private listeners = new Set<EventHandler>();
  private sequenceCounter = 0;
  private ready = false;
  private startTimeMs = 0;
  private currentLanguage = "en-US";

  async initialize(
    _modelId: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      this.emit({
        type: "ASR_STATUS",
        state: "error",
        message: "Speech recognition not supported in this browser",
      });
      throw new Error("SpeechRecognition not supported");
    }

    onProgress?.(100);
    this.ready = true;
    this.emit({
      type: "ASR_STATUS",
      state: "ready",
      message: "Web Speech API ready",
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  startListening(options: ASROptions): void {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.currentLanguage =
      options.language === "auto" ? "en-US" : options.language;
    this.recognition.lang = this.currentLanguage;

    this.sequenceCounter = 0;
    this.startTimeMs = Date.now();

    this.recognition.onstart = () => {
      this.emit({
        type: "ASR_STATUS",
        state: "listening",
        message: "Listening (Web Speech API)...",
      });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = Date.now();
      const elapsed = now - this.startTimeMs;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          this.emit({
            type: "ASR_FINAL",
            text: transcript,
            tStartMs: elapsed - 2000,
            tEndMs: elapsed,
            speaker: null,
            confidence: result[0]?.confidence ?? null,
            sequence: this.sequenceCounter++,
          });
        } else {
          this.emit({
            type: "ASR_PARTIAL",
            text: transcript,
            tStartMs: elapsed,
          });
        }
      }
    };

    this.recognition.onerror = (event) => {
      const errorEvent = event as Event & { error: string };
      if (errorEvent.error !== "no-speech") {
        this.emit({
          type: "ASR_STATUS",
          state: "error",
          message: `Speech recognition error: ${errorEvent.error}`,
        });
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if not explicitly stopped
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch {
          // Already started or disposed
        }
      }
    };

    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      rec.onend = null; // Prevent auto-restart
      rec.stop();
    }
    this.emit({
      type: "ASR_STATUS",
      state: "stopped",
      message: "Transcription stopped",
    });
  }

  pauseListening(): void {
    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      rec.onend = null;
      rec.stop();
    }
    this.emit({
      type: "ASR_STATUS",
      state: "paused",
      message: "Transcription paused",
    });
  }

  resumeListening(): void {
    // Re-create and start with the previously selected language
    this.startListening({
      language: this.currentLanguage,
      sampleRate: 16000,
    });
  }

  onEvent(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  dispose(): void {
    this.stopListening();
    this.listeners.clear();
    this.ready = false;
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
