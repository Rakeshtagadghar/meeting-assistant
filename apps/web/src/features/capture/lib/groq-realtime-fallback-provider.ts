import type { ASREvent, ASROptions, ASRProvider } from "@ainotes/core";
import { AI_MODELS } from "@ainotes/config/ai-models";

type EventHandler = (event: ASREvent) => void;

interface GroqTranscribeResponse {
  text?: string;
}

const GROQ_MAX_REQUESTS_PER_MINUTE = 20;
const GROQ_RATE_LIMIT_WINDOW_MS = 60_000;
const GROQ_FLUSH_INTERVAL_MS = 3000;
const GROQ_RATE_LIMIT_NOTICE_COOLDOWN_MS = 5000;

export class GroqRealtimeFallbackProvider implements ASRProvider {
  readonly name = "groq-whisper-realtime-fallback";
  readonly platform = "web" as const;

  private ready = false;
  private listeners = new Set<EventHandler>();
  private sequenceCounter = 0;
  private currentLanguage = "auto";
  private enableSystemAudio = true;
  private elapsedMs = 0;

  private mediaStream: MediaStream | null = null;
  private systemAudioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private systemSourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;

  private paused = false;
  private inFlight = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pendingSamples: Float32Array[] = [];
  private pendingLength = 0;
  private lastFinalText = "";
  private requestTimestampsMs: number[] = [];
  private lastRateLimitNoticeAtMs = 0;

  async initialize(
    _modelId: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    onProgress?.(100);
    this.ready = true;
    this.emit({
      type: "ASR_STATUS",
      state: "ready",
      message: `${AI_MODELS.groq.realtimeTranscription} fallback ready`,
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  startListening(options: ASROptions): void {
    void this.startListeningInternal(options);
  }

  private async startListeningInternal(options: ASROptions): Promise<void> {
    this.teardown(false);
    this.sequenceCounter = 0;
    this.currentLanguage = options.language || "auto";
    this.enableSystemAudio = options.enableSystemAudio !== false;
    this.elapsedMs = 0;
    this.pendingSamples = [];
    this.pendingLength = 0;
    this.inFlight = false;
    this.paused = false;
    this.lastFinalText = "";
    this.requestTimestampsMs = [];
    this.lastRateLimitNoticeAtMs = 0;

    try {
      await this.startCapture(this.enableSystemAudio);
      this.startFlushLoop();
      this.emit({
        type: "ASR_STATUS",
        state: "listening",
        message: this.enableSystemAudio
          ? "Listening (Groq fallback, mic + shared audio)..."
          : "Listening (Groq fallback, mic only)...",
      });
    } catch (error) {
      this.stopListening();
      this.emit({
        type: "ASR_STATUS",
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to start Groq fallback provider",
      });
    }
  }

  stopListening(): void {
    this.teardown(true);
  }

  pauseListening(): void {
    this.paused = true;
    void this.audioContext?.suspend();
    this.emit({
      type: "ASR_STATUS",
      state: "paused",
      message: "Transcription paused",
    });
  }

  resumeListening(): void {
    this.paused = false;
    void this.audioContext?.resume();
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
    this.teardown(false);
    this.listeners.clear();
    this.ready = false;
  }

  private teardown(emitStopped: boolean): void {
    this.stopFlushLoop();
    this.paused = false;
    this.inFlight = false;
    this.pendingSamples = [];
    this.pendingLength = 0;
    this.requestTimestampsMs = [];
    this.lastRateLimitNoticeAtMs = 0;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }

    if (this.systemSourceNode) {
      this.systemSourceNode.disconnect();
      this.systemSourceNode = null;
    }

    if (this.silentGainNode) {
      this.silentGainNode.disconnect();
      this.silentGainNode = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.systemAudioStream) {
      this.systemAudioStream.getTracks().forEach((track) => track.stop());
      this.systemAudioStream = null;
    }

    if (emitStopped) {
      this.emit({
        type: "ASR_STATUS",
        state: "stopped",
        message: "Transcription stopped",
      });
    }
  }

  private async startCapture(includeSystemAudio: boolean): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: 16000 },
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.micSourceNode = this.audioContext.createMediaStreamSource(
      this.mediaStream,
    );

    if (includeSystemAudio && navigator.mediaDevices.getDisplayMedia) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "browser",
            // @ts-expect-error Chromium-only hint
            preferCurrentTab: true,
          },
          audio: true,
        });
        const systemTrack = displayStream.getAudioTracks()[0] ?? null;
        if (systemTrack) {
          const stream = new MediaStream([systemTrack]);
          this.systemAudioStream = stream;
          this.systemSourceNode =
            this.audioContext.createMediaStreamSource(stream);
        } else {
          displayStream.getTracks().forEach((track) => track.stop());
        }
      } catch {
        // continue with mic only
      }
    }

    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this.paused) return;
      const channelData = event.inputBuffer.getChannelData(0);
      const samples = new Float32Array(channelData);
      this.pendingSamples.push(samples);
      this.pendingLength += samples.length;
    };

    this.silentGainNode = this.audioContext.createGain();
    this.silentGainNode.gain.value = 0;
    this.silentGainNode.connect(this.audioContext.destination);

    this.micSourceNode.connect(this.processorNode);
    this.systemSourceNode?.connect(this.processorNode);
    this.processorNode.connect(this.silentGainNode);
  }

  private startFlushLoop(): void {
    this.stopFlushLoop();
    this.flushTimer = setInterval(() => {
      void this.flushAudioChunk();
    }, GROQ_FLUSH_INTERVAL_MS);
  }

  private stopFlushLoop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async flushAudioChunk(): Promise<void> {
    if (this.inFlight || this.pendingLength === 0) {
      return;
    }

    if (!this.tryAcquireRequestSlot(Date.now())) {
      return;
    }

    const merged = new Float32Array(this.pendingLength);
    let offset = 0;
    for (const chunk of this.pendingSamples) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pendingSamples = [];
    this.pendingLength = 0;

    const pcm16 = float32ToPCM16(merged);
    const wavBytes = encodeWavPcm16(pcm16, 16000);
    const durationMs = Math.max(
      250,
      Math.round((merged.length / 16000) * 1000),
    );
    const tStartMs = this.elapsedMs;
    const tEndMs = this.elapsedMs + durationMs;
    this.elapsedMs = tEndMs;
    const prosody = estimateProsody(merged, durationMs);

    this.inFlight = true;
    try {
      const response = await fetch("/api/asr/groq/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64FromBytes(wavBytes),
          mimeType: "audio/wav",
          language: this.currentLanguage,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          this.emit({
            type: "ASR_STATUS",
            state: "processing",
            message: "Groq request cap reached (20/min). Buffering audio...",
          });
          return;
        }
        this.emit({
          type: "ASR_STATUS",
          state: "processing",
          message: "Groq fallback transcription retrying...",
        });
        return;
      }

      const data = (await response.json()) as GroqTranscribeResponse;
      const text = (data.text ?? "").trim();
      if (!text || text === this.lastFinalText) return;

      this.lastFinalText = text;
      this.emit({
        type: "ASR_FINAL",
        text,
        tStartMs,
        tEndMs,
        speaker: null,
        speakerRole: "UNKNOWN",
        audioSource: this.enableSystemAudio ? "tabAudio" : "microphone",
        prosodyEnergy: prosody.energy,
        prosodyPauseRatio: prosody.pauseRatio,
        prosodyVoicedMs: prosody.voicedMs,
        prosodySnrDb: prosody.snrDb,
        confidence: null,
        sequence: this.sequenceCounter++,
      });
    } catch {
      this.emit({
        type: "ASR_STATUS",
        state: "processing",
        message: "Groq fallback transcription retrying...",
      });
    } finally {
      this.inFlight = false;
    }
  }

  private tryAcquireRequestSlot(nowMs: number): boolean {
    this.requestTimestampsMs = this.requestTimestampsMs.filter(
      (timestampMs) => nowMs - timestampMs < GROQ_RATE_LIMIT_WINDOW_MS,
    );
    if (this.requestTimestampsMs.length >= GROQ_MAX_REQUESTS_PER_MINUTE) {
      if (
        nowMs - this.lastRateLimitNoticeAtMs >
        GROQ_RATE_LIMIT_NOTICE_COOLDOWN_MS
      ) {
        this.lastRateLimitNoticeAtMs = nowMs;
        this.emit({
          type: "ASR_STATUS",
          state: "processing",
          message: "Groq rate-limit guard active (20 req/min). Buffering...",
        });
      }
      return false;
    }
    this.requestTimestampsMs.push(nowMs);
    return true;
  }

  private emit(event: ASREvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch {
        // isolate consumer errors
      }
    }
  }
}

function float32ToPCM16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }
  return out;
}

function encodeWavPcm16(samples: Int16Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i] ?? 0, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function estimateProsody(
  samples: Float32Array,
  durationMs: number,
): {
  energy: number;
  pauseRatio: number;
  voicedMs: number;
  snrDb: number;
} {
  if (samples.length === 0) {
    return { energy: 0, pauseRatio: 1, voicedMs: 0, snrDb: 0 };
  }

  const threshold = 0.015;
  let sumSq = 0;
  let voiced = 0;
  let noiseSq = 0;
  let noiseCount = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] ?? 0;
    const abs = Math.abs(value);
    sumSq += value * value;
    if (abs >= threshold) {
      voiced += 1;
    } else {
      noiseSq += value * value;
      noiseCount += 1;
    }
  }

  const rms = Math.sqrt(sumSq / samples.length);
  const voicedRatio = voiced / samples.length;
  const pauseRatio = Math.max(0, Math.min(1, 1 - voicedRatio));
  const voicedMs = Math.max(0, Math.min(durationMs, durationMs * voicedRatio));
  const noiseRms =
    noiseCount > 0
      ? Math.sqrt(noiseSq / noiseCount)
      : Math.max(rms * 0.1, 1e-4);
  const snrDb = 20 * Math.log10((rms + 1e-6) / (noiseRms + 1e-6));

  return {
    energy: Number(Math.max(0, Math.min(1, rms * 4)).toFixed(3)),
    pauseRatio: Number(pauseRatio.toFixed(3)),
    voicedMs: Number(voicedMs.toFixed(1)),
    snrDb: Number(Math.max(-5, Math.min(45, snrDb)).toFixed(1)),
  };
}
