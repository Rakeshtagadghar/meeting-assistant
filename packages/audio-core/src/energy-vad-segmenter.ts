import type { PcmFrame } from "./pcm-packetizer";

export interface EnergyVadSegmenterOptions {
  frameMs: number;
  minSpeechMs: number;
  finalizeOnSilenceMs: number;
  energyThreshold: number;
  dropSilenceFrames?: boolean;
}

export interface VadSegmenterResult {
  emitFrames: PcmFrame[];
  finalizeUtterance: boolean;
}

const EMPTY_RESULT: VadSegmenterResult = Object.freeze({
  emitFrames: [],
  finalizeUtterance: false,
});

export class EnergyVadSegmenter {
  private readonly options: EnergyVadSegmenterOptions;
  private speechActive = false;
  private activeSilenceMs = 0;
  private preSpeechFrames: PcmFrame[] = [];

  constructor(options: EnergyVadSegmenterOptions) {
    this.options = options;
  }

  pushFrame(frame: PcmFrame): VadSegmenterResult {
    const isSpeech =
      normalizedRms(frame.samples) >= this.options.energyThreshold;

    if (this.speechActive) {
      if (isSpeech) {
        this.activeSilenceMs = 0;
        return {
          emitFrames: [frame],
          finalizeUtterance: false,
        };
      }

      this.activeSilenceMs += this.options.frameMs;
      const finalizeUtterance =
        this.activeSilenceMs >= this.options.finalizeOnSilenceMs;
      if (finalizeUtterance) {
        this.speechActive = false;
        this.activeSilenceMs = 0;
      }

      if (this.options.dropSilenceFrames ?? true) {
        return {
          emitFrames: [],
          finalizeUtterance,
        };
      }

      return {
        emitFrames: [frame],
        finalizeUtterance,
      };
    }

    if (!isSpeech) {
      this.preSpeechFrames = [];
      return EMPTY_RESULT;
    }

    this.preSpeechFrames.push(frame);
    const bufferedSpeechMs = this.preSpeechFrames.length * this.options.frameMs;
    if (bufferedSpeechMs < this.options.minSpeechMs) {
      return EMPTY_RESULT;
    }

    const emitFrames = this.preSpeechFrames;
    this.preSpeechFrames = [];
    this.speechActive = true;
    this.activeSilenceMs = 0;
    return {
      emitFrames,
      finalizeUtterance: false,
    };
  }

  flush(): VadSegmenterResult {
    this.preSpeechFrames = [];
    const finalizeUtterance = this.speechActive;
    this.speechActive = false;
    this.activeSilenceMs = 0;
    return {
      emitFrames: [],
      finalizeUtterance,
    };
  }
}

function normalizedRms(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] ?? 0;
    sumSquares += sample * sample;
  }
  const meanSquare = sumSquares / samples.length;
  const rms = Math.sqrt(meanSquare);
  return rms / 32768;
}
