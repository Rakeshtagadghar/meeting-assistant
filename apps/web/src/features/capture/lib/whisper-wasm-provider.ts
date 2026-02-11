/**
 * Whisper WASM ASR Provider.
 *
 * Implements the ASRProvider interface using @huggingface/transformers
 * running in a Web Worker for non-blocking inference.
 *
 * Audio pipeline: getUserMedia → AudioWorklet → VAD → rolling window → Worker transcription
 * Speaker detection: voice fingerprinting via pitch (F0) and spectral centroid comparison
 */

import type { ASREvent, ASROptions, ASRProvider } from "@ainotes/core";
import { SimpleVAD } from "./vad";
import { SpeakerDetector } from "./speaker-detector";

// Web streaming config
const WEB_CONFIG = {
  contextWindowSec: 20,
  stepSec: 4,
  overlapSec: 1,
};

type EventHandler = (event: ASREvent) => void;

export class WhisperWASMProvider implements ASRProvider {
  readonly name = "whisper-wasm";
  readonly platform = "web" as const;

  private ready = false;
  private listeners = new Set<EventHandler>();
  private sequenceCounter = 0;

  // Web Worker for Whisper inference
  private worker: Worker | null = null;
  private pendingResolve: ((text: string) => void) | null = null;

  // Audio pipeline
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Audio buffering
  private audioBuffer: Float32Array[] = [];
  private audioBufferLengthSamples = 0;
  private sampleRate = 16000;

  // VAD
  private vad = new SimpleVAD({ silenceDurationMs: 700 });

  // Rolling window state
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private lastProcessedMs = 0;

  // Language for transcription
  private currentLanguage = "auto";

  // Speaker detection via voice fingerprinting
  private readonly speakerDetector = new SpeakerDetector();

  async initialize(
    modelId: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    this.emit({
      type: "ASR_STATUS",
      state: "loading",
      message: `Loading ${modelId} model...`,
    });

    try {
      // Create Web Worker for inference
      this.worker = new Worker(
        new URL("./whisper-worker.ts", import.meta.url),
        { type: "module" },
      );

      // Set up persistent message handler for transcription results
      this.worker.onmessage = (e: MessageEvent) => {
        const msg = e.data as {
          type: string;
          status?: string;
          progress?: number;
          text?: string;
          message?: string;
        };

        if (msg.type === "result") {
          if (this.pendingResolve) {
            this.pendingResolve(msg.text ?? "");
            this.pendingResolve = null;
          }
        } else if (msg.type === "error" && this.pendingResolve) {
          this.pendingResolve("");
          this.pendingResolve = null;
        }
      };

      // Wait for model load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Model load timeout (120s)")),
          120_000,
        );

        const onMessage = (e: MessageEvent) => {
          const msg = e.data as {
            type: string;
            status?: string;
            progress?: number;
            message?: string;
          };

          if (msg.type === "progress" && typeof msg.progress === "number") {
            onProgress?.(Math.round(msg.progress));
          }

          if (msg.type === "status" && msg.status === "ready") {
            clearTimeout(timeout);
            this.worker!.removeEventListener("message", onMessage);
            resolve();
          }

          if (msg.type === "error") {
            clearTimeout(timeout);
            this.worker!.removeEventListener("message", onMessage);
            reject(new Error(msg.message ?? "Worker error"));
          }
        };

        this.worker!.addEventListener("message", onMessage);
        this.worker!.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };

        // Tell worker to load the model
        this.worker!.postMessage({ type: "load", modelId });
      });

      this.ready = true;
      onProgress?.(100);
      this.emit({
        type: "ASR_STATUS",
        state: "ready",
        message: "Model loaded, ready to listen",
      });
    } catch (err) {
      this.emit({
        type: "ASR_STATUS",
        state: "error",
        message: `Failed to load model: ${err instanceof Error ? err.message : "unknown error"}`,
      });
      throw err;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  startListening(options: ASROptions): void {
    this.sampleRate = options.sampleRate || 16000;
    this.currentLanguage = options.language || "auto";
    this.sequenceCounter = 0;
    this.audioBuffer = [];
    this.audioBufferLengthSamples = 0;
    this.vad.reset();
    this.speakerDetector.reset();

    this.startAudioCapture().catch((err) => {
      this.emit({
        type: "ASR_STATUS",
        state: "error",
        message: `Mic access failed: ${err instanceof Error ? err.message : "unknown"}`,
      });
    });
  }

  stopListening(): void {
    this.stopAudioCapture();
    this.emit({
      type: "ASR_STATUS",
      state: "stopped",
      message: "Transcription stopped",
    });
  }

  pauseListening(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.emit({
      type: "ASR_STATUS",
      state: "paused",
      message: "Transcription paused",
    });
  }

  resumeListening(): void {
    this.startProcessingLoop();
    this.emit({
      type: "ASR_STATUS",
      state: "listening",
      message: "Transcription resumed",
    });
  }

  onEvent(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  dispose(): void {
    this.stopAudioCapture();
    this.listeners.clear();

    if (this.worker) {
      this.worker.postMessage({ type: "dispose" });
      this.worker.terminate();
      this.worker = null;
    }

    this.ready = false;
  }

  /** Get current mic level (0-1) from the analyser node */
  getMicLevel(): number {
    if (!this.analyserNode) return 0;
    const data = new Uint8Array(this.analyserNode.fftSize);
    this.analyserNode.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i]! - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    return Math.min(1, rms * 3);
  }

  // ─── Private ───

  private emit(event: ASREvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch {
        // Don't let handler errors break the pipeline
      }
    }
  }

  private async startAudioCapture(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: this.sampleRate },
        channelCount: { exact: 1 },
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext({
      sampleRate: this.sampleRate,
    });

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Analyser for mic level visualization
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    source.connect(this.analyserNode);

    // Try AudioWorklet, fall back to ScriptProcessor
    try {
      await this.audioContext.audioWorklet.addModule("/audio-pcm-worklet.js");
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "pcm-processor",
      );

      this.workletNode.port.onmessage = (event: MessageEvent) => {
        const { samples } = event.data as { samples: Float32Array };
        this.onAudioSamples(samples);
      };

      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
    } catch {
      // Fallback: ScriptProcessorNode (deprecated but widely supported)
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const samples = new Float32Array(e.inputBuffer.getChannelData(0));
        this.onAudioSamples(samples);
      };
      source.connect(processor);
      processor.connect(this.audioContext.destination);
    }

    this.emit({
      type: "ASR_STATUS",
      state: "listening",
      message: "Listening...",
    });

    this.startProcessingLoop();
  }

  private stopAudioCapture(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.workletNode) {
      this.workletNode.port.postMessage({ command: "stop" });
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    this.analyserNode = null;
  }

  private onAudioSamples(samples: Float32Array): void {
    this.audioBuffer.push(samples);
    this.audioBufferLengthSamples += samples.length;

    // Run VAD on each incoming frame
    const currentTimeMs =
      (this.audioBufferLengthSamples / this.sampleRate) * 1000;
    const vadResult = this.vad.process(samples, this.sampleRate, currentTimeMs);

    // If VAD says finalize, trigger immediate processing
    if (vadResult.shouldFinalize && !this.isProcessing) {
      void this.processAudioWindow();
    }
  }

  private startProcessingLoop(): void {
    const intervalMs = WEB_CONFIG.stepSec * 1000;
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        void this.processAudioWindow();
      }
    }, intervalMs);
  }

  private async processAudioWindow(): Promise<void> {
    if (this.isProcessing || this.audioBuffer.length === 0 || !this.worker)
      return;
    this.isProcessing = true;

    try {
      const totalSamples = this.audioBufferLengthSamples;
      const windowSamples = WEB_CONFIG.contextWindowSec * this.sampleRate;
      const fullBuffer = new Float32Array(
        Math.min(totalSamples, windowSamples),
      );
      let writeOffset = fullBuffer.length;

      // Copy from the end of the buffer backwards
      for (
        let i = this.audioBuffer.length - 1;
        i >= 0 && writeOffset > 0;
        i--
      ) {
        const chunk = this.audioBuffer[i]!;
        const copyLength = Math.min(chunk.length, writeOffset);
        fullBuffer.set(
          chunk.subarray(chunk.length - copyLength),
          writeOffset - copyLength,
        );
        writeOffset -= copyLength;
      }

      const currentTimeMs = (totalSamples / this.sampleRate) * 1000;

      // Keep a copy for speaker detection before transferring to worker
      const audioForSpeaker = new Float32Array(fullBuffer);

      // Send to worker for transcription (transfer buffer for zero-copy)
      const text = await new Promise<string>((resolve) => {
        this.pendingResolve = resolve;
        this.worker!.postMessage(
          {
            type: "transcribe",
            audio: fullBuffer,
            language: this.currentLanguage,
          },
          [fullBuffer.buffer],
        );
      });

      if (text) {
        // Emit as partial
        this.emit({
          type: "ASR_PARTIAL",
          text,
          tStartMs: this.lastProcessedMs,
        });

        // Check VAD for end-of-speech — use a small tail of the audio buffer
        const tailSamples =
          this.audioBuffer.length > 0
            ? this.audioBuffer[this.audioBuffer.length - 1]!
            : new Float32Array(1);
        const vadCheck = this.vad.process(
          tailSamples,
          this.sampleRate,
          currentTimeMs,
        );

        if (vadCheck.shouldFinalize || vadCheck.silenceDurationMs > 500) {
          // Detect speaker by comparing voice characteristics (pitch + spectral)
          const speakerLabel = this.speakerDetector.detect(
            audioForSpeaker,
            this.sampleRate,
          );

          this.emit({
            type: "ASR_FINAL",
            text,
            tStartMs: this.lastProcessedMs,
            tEndMs: currentTimeMs,
            speaker: speakerLabel,
            confidence: null,
            sequence: this.sequenceCounter++,
          });

          this.lastProcessedMs = currentTimeMs;
          this.trimAudioBuffer(WEB_CONFIG.overlapSec);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private trimAudioBuffer(keepSeconds: number): void {
    const keepSamples = keepSeconds * this.sampleRate;
    let totalSamples = 0;

    let keepFromIndex = this.audioBuffer.length;
    for (let i = this.audioBuffer.length - 1; i >= 0; i--) {
      totalSamples += this.audioBuffer[i]!.length;
      if (totalSamples >= keepSamples) {
        keepFromIndex = i;
        break;
      }
    }

    this.audioBuffer = this.audioBuffer.slice(keepFromIndex);
    this.audioBufferLengthSamples = this.audioBuffer.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
  }
}
