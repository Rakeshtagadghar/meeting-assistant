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

const MIN_SIGNAL_RMS = 0.008;
const SILENCE_FINALIZE_MS = 1200;

export class WhisperWASMProvider implements ASRProvider {
  readonly name = "whisper-wasm";
  readonly platform = "web" as const;

  private ready = false;
  private listeners = new Set<EventHandler>();
  private sequenceCounter = 0;

  // Tracking total samples processed to keep VAD time monotonic
  private totalProcessedSamples = 0;

  // Web Worker for Whisper inference
  private worker: Worker | null = null;
  private pendingResolve: ((text: string) => void) | null = null;

  // Audio pipeline
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private systemAudioStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private systemSourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Keep a silent sink node alive (prevents feedback / loopback)
  private silentGainNode: GainNode | null = null;

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

  // Pause + partial de-dupe
  private isPaused = false;
  private lastPartialText = "";
  private processingEpoch = 0;
  private sawLongSilenceSinceLastSpeech = false;

  // Segment id (lets UI upsert partials if you use it)
  private segmentId = 0;

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
      this.worker = new Worker(
        new URL("./whisper-worker.ts", import.meta.url),
        { type: "module" },
      );

      // persistent handler for transcription results
      this.worker.onmessage = (e: MessageEvent) => {
        const msg = e.data as {
          type: string;
          text?: string;
        };

        if (msg.type === "result" && this.pendingResolve) {
          this.pendingResolve(msg.text ?? "");
          this.pendingResolve = null;
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
            this.worker?.removeEventListener("message", onMessage);
            resolve();
          }

          if (msg.type === "error") {
            clearTimeout(timeout);
            this.worker?.removeEventListener("message", onMessage);
            reject(new Error(msg.message ?? "Worker error"));
          }
        };

        this.worker?.addEventListener("message", onMessage);
        this.worker!.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };

        this.worker?.postMessage({ type: "load", modelId });
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
    this.stopAudioCapture();
    this.processingEpoch++;

    this.sampleRate = options.sampleRate || 16000;
    this.currentLanguage = options.language || "auto";

    // reset state
    this.sequenceCounter = 0;
    this.segmentId = 0;
    this.audioBuffer = [];
    this.audioBufferLengthSamples = 0;
    this.sawLongSilenceSinceLastSpeech = false;
    this.totalProcessedSamples = 0;
    this.lastProcessedMs = 0;
    this.isPaused = false;
    this.lastPartialText = "";

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
    this.isPaused = true;
    this.processingEpoch++;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.audioContext?.suspend().catch(() => {});

    if (this.pendingResolve) {
      this.pendingResolve("");
      this.pendingResolve = null;
    }

    // Preserve the currently visible partial as a final segment so UI does not
    // upsert/replace older text when speaking resumes after a pause.
    this.finalizeCurrentPartialSegment();
    this.discardBufferedAudio();

    this.emit({
      type: "ASR_STATUS",
      state: "paused",
      message: "Transcription paused",
    });
  }

  private finalizeCurrentPartialSegment(): void {
    const text = this.cleanText(this.lastPartialText);
    if (!text) return;

    const bufferedDurationMs =
      (this.audioBufferLengthSamples / this.sampleRate) * 1000;
    const durationMs = Math.max(250, bufferedDurationMs);

    this.emitFinal(text, this.lastProcessedMs, durationMs);
    this.segmentId++;
    this.lastPartialText = "";
    this.lastProcessedMs += durationMs;
  }

  private discardBufferedAudio(): void {
    if (this.audioBufferLengthSamples > 0) {
      this.totalProcessedSamples += this.audioBufferLengthSamples;
    }

    this.audioBuffer = [];
    this.audioBufferLengthSamples = 0;
    this.sawLongSilenceSinceLastSpeech = false;
  }

  resumeListening(): void {
    this.isPaused = false;
    this.audioContext?.resume().catch(() => {});
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
        // exact channel count fails in some Safari/iPadOS combinations
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });

    this.micSourceNode = this.audioContext.createMediaStreamSource(
      this.mediaStream,
    );

    await this.tryAttachSystemAudio();

    const inputSources: MediaStreamAudioSourceNode[] = [this.micSourceNode];
    if (this.systemSourceNode) {
      inputSources.push(this.systemSourceNode);
    }

    this.silentGainNode = this.audioContext.createGain();
    this.silentGainNode.gain.value = 0;
    this.silentGainNode.connect(this.audioContext.destination);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    inputSources.forEach((inputSource) =>
      inputSource.connect(this.analyserNode!),
    );

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

      inputSources.forEach((inputSource) =>
        inputSource.connect(this.workletNode!),
      );
      this.workletNode.connect(this.silentGainNode);
    } catch {
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(
        4096,
        1,
        1,
      );
      this.scriptProcessorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        const samples = new Float32Array(e.inputBuffer.getChannelData(0));
        this.onAudioSamples(samples);
      };

      inputSources.forEach((inputSource) =>
        inputSource.connect(this.scriptProcessorNode!),
      );
      this.scriptProcessorNode.connect(this.silentGainNode);
    }

    this.emit({
      type: "ASR_STATUS",
      state: "listening",
      message: this.systemSourceNode
        ? "Listening to mic + shared audio..."
        : "Listening...",
    });

    this.startProcessingLoop();
  }

  private async tryAttachSystemAudio(): Promise<void> {
    if (!this.audioContext || !navigator.mediaDevices.getDisplayMedia) {
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // Helps users pick the exact browser tab where YouTube/meeting audio is playing.
          // TypeScript DOM lib may not include newer fields in every TS version.
          // @ts-expect-error
          displaySurface: "browser",
          // @ts-expect-error
          preferCurrentTab: true,
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // @ts-expect-error - Chromium only
          suppressLocalAudioPlayback: false,
        },
      });

      const systemAudioTrack = displayStream.getAudioTracks()[0] ?? null;
      if (!systemAudioTrack) {
        displayStream.getTracks().forEach((track) => track.stop());
        this.emit({
          type: "ASR_STATUS",
          state: "listening",
          message:
            "No shared audio detected. Share a browser tab and enable tab audio.",
        });
        return;
      }

      const audioOnlyStream = new MediaStream([systemAudioTrack]);
      this.systemAudioStream = audioOnlyStream;
      this.systemSourceNode =
        this.audioContext.createMediaStreamSource(audioOnlyStream);

      systemAudioTrack.onended = () => {
        this.emit({
          type: "ASR_STATUS",
          state: "listening",
          message: "Shared tab audio stopped. Re-share tab audio to continue.",
        });
      };
    } catch {
      this.emit({
        type: "ASR_STATUS",
        state: "listening",
        message: "System audio not enabled; continuing with mic only.",
      });
    }
  }

  private stopAudioCapture(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.isPaused = false;
    this.isProcessing = false;
    this.lastPartialText = "";

    if (this.workletNode) {
      this.workletNode.port.postMessage({ command: "stop" });
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode.onaudioprocess = null;
      this.scriptProcessorNode = null;
    }

    if (this.silentGainNode) {
      this.silentGainNode.disconnect();
      this.silentGainNode = null;
    }

    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }

    if (this.systemSourceNode) {
      this.systemSourceNode.disconnect();
      this.systemSourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.systemAudioStream) {
      this.systemAudioStream.getTracks().forEach((t) => t.stop());
      this.systemAudioStream = null;
    }

    this.analyserNode = null;

    this.discardBufferedAudio();
  }

  private onAudioSamples(samples: Float32Array): void {
    if (this.isPaused) return;

    const totalSamplesWithIncoming =
      this.totalProcessedSamples +
      this.audioBufferLengthSamples +
      samples.length;
    const currentTimeMs = (totalSamplesWithIncoming / this.sampleRate) * 1000;
    const vadResult = this.vad.process(samples, this.sampleRate, currentTimeMs);

    if (
      !vadResult.isSpeech &&
      vadResult.silenceDurationMs >= SILENCE_FINALIZE_MS
    ) {
      this.sawLongSilenceSinceLastSpeech = true;
    }

    if (vadResult.isSpeech && this.sawLongSilenceSinceLastSpeech) {
      this.finalizeCurrentPartialSegment();
      this.discardBufferedAudio();
      this.sawLongSilenceSinceLastSpeech = false;
    }

    this.audioBuffer.push(samples);
    this.audioBufferLengthSamples += samples.length;

    if (vadResult.shouldFinalize && !this.isProcessing) {
      void this.processAudioWindow();
    }
  }

  private startProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    const intervalMs = WEB_CONFIG.stepSec * 1000;
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing && !this.isPaused) {
        void this.processAudioWindow();
      }
    }, intervalMs);
  }

  private rms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i]!;
      sum += v * v;
    }
    return Math.sqrt(sum / samples.length);
  }

  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }

  private shouldStartNewSegmentFromText(nextText: string): boolean {
    const prev = this.cleanText(this.lastPartialText).toLowerCase();
    const next = this.cleanText(nextText).toLowerCase();

    if (!prev || !next || prev === next) return false;

    // Typical streaming growth should keep previous text as prefix.
    if (next.startsWith(prev)) return false;

    // Whisper can occasionally return a shorter correction; don't rotate yet.
    if (prev.startsWith(next)) return false;

    // If there is still strong overlap at the tail, treat it as same segment.
    const prevTail = prev.split(" ").slice(-4).join(" ");
    if (prevTail.length >= 12 && next.includes(prevTail)) return false;

    return true;
  }

  private advanceRollingWindow(): void {
    const stepSamples = Math.floor(WEB_CONFIG.stepSec * this.sampleRate);
    const overlapSamples = Math.floor(WEB_CONFIG.overlapSec * this.sampleRate);

    const maxConsumable = Math.max(
      0,
      this.audioBufferLengthSamples - overlapSamples,
    );
    const toConsume = Math.min(stepSamples, maxConsumable);

    if (toConsume > 0) {
      this.consumeAudioBuffer(toConsume);
      this.lastProcessedMs += (toConsume / this.sampleRate) * 1000;
    }
  }

  private async processAudioWindow(): Promise<void> {
    if (
      this.isProcessing ||
      this.isPaused ||
      this.audioBuffer.length === 0 ||
      !this.worker
    ) {
      return;
    }

    this.isProcessing = true;
    const epochAtStart = this.processingEpoch;

    try {
      const totalSamples = this.audioBufferLengthSamples;
      const windowSamples = WEB_CONFIG.contextWindowSec * this.sampleRate;
      const fullBuffer = new Float32Array(
        Math.min(totalSamples, windowSamples),
      );

      // Copy from end backward (most recent context)
      let writeOffset = fullBuffer.length;
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

      const audioForSpeaker = new Float32Array(fullBuffer);

      if (this.rms(audioForSpeaker) < MIN_SIGNAL_RMS) {
        this.advanceRollingWindow();
        return;
      }

      const text = this.cleanText(
        await new Promise<string>((resolve) => {
          this.pendingResolve = resolve;
          this.worker!.postMessage(
            {
              type: "transcribe",
              audio: fullBuffer,
              language: this.currentLanguage,
            },
            [fullBuffer.buffer],
          );
        }),
      );

      // Ignore stale transcriptions returned after pause/stop/start transitions.
      if (epochAtStart !== this.processingEpoch || this.isPaused) {
        return;
      }

      if (!text) {
        this.advanceRollingWindow();
        return;
      }

      // repetitive garbage guard
      if (/(?:\b2-){20,}/.test(text) || /(?:-2){40,}/.test(text)) {
        this.advanceRollingWindow();
        return;
      }

      if (this.shouldStartNewSegmentFromText(text)) {
        this.finalizeCurrentPartialSegment();
        this.discardBufferedAudio();
      }

      if (text !== this.lastPartialText) {
        this.lastPartialText = text;
        this.emit({
          type: "ASR_PARTIAL",
          text,
          tStartMs: this.lastProcessedMs,
          // @ts-expect-error - add to ASREvent to type this field
          segmentId: this.segmentId,
        });
      }

      const tailSamples =
        this.audioBuffer.length > 0
          ? this.audioBuffer[this.audioBuffer.length - 1]!
          : new Float32Array(1);

      const vadTimeMs =
        ((this.totalProcessedSamples + this.audioBufferLengthSamples) /
          this.sampleRate) *
        1000;
      const vadCheck = this.vad.process(
        tailSamples,
        this.sampleRate,
        vadTimeMs,
      );

      const overlapSamples = Math.floor(
        WEB_CONFIG.overlapSec * this.sampleRate,
      );

      if (vadCheck.shouldFinalize || vadCheck.silenceDurationMs > 500) {
        const speakerLabel = this.speakerDetector.detect(
          audioForSpeaker,
          this.sampleRate,
        );
        const durationMs = (audioForSpeaker.length / this.sampleRate) * 1000;

        this.emitFinal(text, this.lastProcessedMs, durationMs, speakerLabel);
        this.segmentId++;
        this.lastPartialText = "";

        const toConsume = Math.max(
          0,
          this.audioBufferLengthSamples - overlapSamples,
        );
        if (toConsume > 0) {
          this.consumeAudioBuffer(toConsume);
          this.lastProcessedMs += (toConsume / this.sampleRate) * 1000;
        }
      } else {
        this.advanceRollingWindow();

        const activeDurationSec =
          this.audioBufferLengthSamples / this.sampleRate;
        const MAX_SEGMENT_DURATION_SEC = 15;
        if (activeDurationSec > MAX_SEGMENT_DURATION_SEC) {
          const durationMs = (audioForSpeaker.length / this.sampleRate) * 1000;
          this.emitFinal(text, this.lastProcessedMs, durationMs);

          this.segmentId++;
          this.lastPartialText = "";

          const toConsume = Math.max(
            0,
            this.audioBufferLengthSamples - overlapSamples,
          );
          if (toConsume > 0) {
            this.consumeAudioBuffer(toConsume);
            this.lastProcessedMs += (toConsume / this.sampleRate) * 1000;
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private emitFinal(
    text: string,
    tStartMs: number,
    durationMs: number,
    speaker: string | null = null,
  ): void {
    this.emit({
      type: "ASR_FINAL",
      text,
      tStartMs,
      tEndMs: tStartMs + durationMs,
      speaker,
      confidence: speaker === null ? 0.8 : null,
      sequence: this.sequenceCounter++,
      // @ts-expect-error - add to ASREvent to type this field
      segmentId: this.segmentId,
    });
  }

  private consumeAudioBuffer(samplesToConsume: number): void {
    let remainingToRemove = samplesToConsume;

    while (remainingToRemove > 0 && this.audioBuffer.length > 0) {
      const chunk = this.audioBuffer[0]!;
      if (chunk.length <= remainingToRemove) {
        remainingToRemove -= chunk.length;
        this.audioBuffer.shift();
      } else {
        this.audioBuffer[0] = chunk.subarray(remainingToRemove);
        remainingToRemove = 0;
      }
    }

    this.audioBufferLengthSamples = this.audioBuffer.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );

    this.totalProcessedSamples += samplesToConsume;
  }
}
