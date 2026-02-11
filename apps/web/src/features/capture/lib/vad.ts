/**
 * Simple energy-based Voice Activity Detection (VAD).
 * Determines if audio contains speech based on RMS energy levels.
 */

export interface VADConfig {
  /** Energy threshold in dB below which audio is considered silence. Default: -40 */
  silenceThresholdDb: number;
  /** Duration of silence (ms) before finalizing a chunk. Default: 700 */
  silenceDurationMs: number;
  /** Minimum speech duration (ms) before a chunk is considered valid. Default: 300 */
  minSpeechDurationMs: number;
}

export interface VADResult {
  isSpeech: boolean;
  silenceDurationMs: number;
  shouldFinalize: boolean;
  rmsDb: number;
}

const DEFAULT_CONFIG: VADConfig = {
  silenceThresholdDb: -40,
  silenceDurationMs: 700,
  minSpeechDurationMs: 300,
};

export class SimpleVAD {
  private config: VADConfig;
  private silenceStartMs: number | null = null;
  private speechStartMs: number | null = null;
  private lastProcessTimeMs = 0;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a frame of audio samples.
   * @param samples Float32Array of audio samples (-1 to 1)
   * @param sampleRate Sample rate in Hz
   * @param currentTimeMs Current time in milliseconds
   */
  process(
    samples: Float32Array,
    sampleRate: number,
    currentTimeMs: number,
  ): VADResult {
    this.lastProcessTimeMs = currentTimeMs;

    // Calculate RMS energy
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i]! * samples[i]!;
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;

    const isSpeech = rmsDb > this.config.silenceThresholdDb;

    if (isSpeech) {
      // Speech detected
      if (this.speechStartMs === null) {
        this.speechStartMs = currentTimeMs;
      }
      this.silenceStartMs = null;
    } else {
      // Silence detected
      if (this.silenceStartMs === null) {
        this.silenceStartMs = currentTimeMs;
      }
    }

    const silenceDurationMs = this.silenceStartMs
      ? currentTimeMs - this.silenceStartMs
      : 0;

    const speechDurationMs = this.speechStartMs
      ? currentTimeMs - this.speechStartMs
      : 0;

    // Should finalize when:
    // 1. We have accumulated enough speech
    // 2. Followed by enough silence
    const shouldFinalize =
      speechDurationMs >= this.config.minSpeechDurationMs &&
      silenceDurationMs >= this.config.silenceDurationMs;

    if (shouldFinalize) {
      // Reset for next segment
      this.speechStartMs = null;
      this.silenceStartMs = null;
    }

    return {
      isSpeech,
      silenceDurationMs,
      shouldFinalize,
      rmsDb,
    };
  }

  reset(): void {
    this.silenceStartMs = null;
    this.speechStartMs = null;
    this.lastProcessTimeMs = 0;
  }

  /** Get normalized mic level (0-1) from the last RMS measurement */
  static rmsToLevel(rmsDb: number): number {
    // Map -60dB..0dB to 0..1
    const clamped = Math.max(-60, Math.min(0, rmsDb));
    return (clamped + 60) / 60;
  }
}
