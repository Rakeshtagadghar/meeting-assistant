import type {
  NativePcmRecorder,
  NativeRecorderFrameHandler,
  NativeRecorderStartOptions,
} from "./mobile-microphone-service";

interface MockSegment {
  speechMs: number;
  silenceMs: number;
  amplitude: number;
}

export interface MockNativePcmRecorderOptions {
  segments?: MockSegment[];
  frequencyHz?: number;
}

const DEFAULT_SEGMENTS: MockSegment[] = [
  { speechMs: 2_800, silenceMs: 500, amplitude: 0.35 },
  { speechMs: 2_200, silenceMs: 700, amplitude: 0.28 },
  { speechMs: 3_000, silenceMs: 900, amplitude: 0.4 },
];

export class MockNativePcmRecorder implements NativePcmRecorder {
  private readonly segments: MockSegment[];
  private readonly frequencyHz: number;

  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private frameHandler: NativeRecorderFrameHandler | null = null;
  private startOptions: NativeRecorderStartOptions | null = null;
  private streamStartMs = 0;
  private phase = 0;

  constructor(options?: MockNativePcmRecorderOptions) {
    this.segments = options?.segments ?? DEFAULT_SEGMENTS;
    this.frequencyHz = options?.frequencyHz ?? 220;
  }

  start(
    options: NativeRecorderStartOptions,
    onFrame: NativeRecorderFrameHandler,
  ): void {
    this.stop();
    this.paused = false;
    this.frameHandler = onFrame;
    this.startOptions = options;
    this.streamStartMs = Date.now();
    this.phase = 0;

    this.timer = setInterval(() => {
      if (!this.frameHandler || !this.startOptions || this.paused) return;

      const sampleCount = Math.max(
        1,
        Math.floor(
          (this.startOptions.sampleRateHz *
            this.startOptions.channels *
            this.startOptions.frameMs) /
            1000,
        ),
      );

      const inSpeech = this.isSpeechAtOffset(Date.now() - this.streamStartMs);
      const samples = new Int16Array(sampleCount);
      if (inSpeech) {
        const amplitude = this.currentAmplitude(
          Date.now() - this.streamStartMs,
        );
        for (let i = 0; i < sampleCount; i++) {
          const angle = 2 * Math.PI * this.frequencyHz * this.phase;
          const value = Math.sin(angle) * amplitude;
          samples[i] = Math.round(value * 32767);
          this.phase += 1 / this.startOptions.sampleRateHz;
        }
      }

      this.frameHandler({
        samples,
        capturedAtMs: Date.now(),
      });
    }, options.frameMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.frameHandler = null;
    this.startOptions = null;
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  private isSpeechAtOffset(offsetMs: number): boolean {
    const cycleMs = this.segments.reduce(
      (sum, segment) => sum + segment.speechMs + segment.silenceMs,
      0,
    );
    if (cycleMs <= 0) return true;
    const pos = offsetMs % cycleMs;
    let cursor = 0;
    for (const segment of this.segments) {
      const speechEnd = cursor + segment.speechMs;
      if (pos >= cursor && pos < speechEnd) return true;
      cursor = speechEnd + segment.silenceMs;
    }
    return false;
  }

  private currentAmplitude(offsetMs: number): number {
    const cycleMs = this.segments.reduce(
      (sum, segment) => sum + segment.speechMs + segment.silenceMs,
      0,
    );
    if (cycleMs <= 0) return 0.3;
    const pos = offsetMs % cycleMs;
    let cursor = 0;
    for (const segment of this.segments) {
      const speechEnd = cursor + segment.speechMs;
      if (pos >= cursor && pos < speechEnd) {
        return segment.amplitude;
      }
      cursor = speechEnd + segment.silenceMs;
    }
    return 0.3;
  }
}
