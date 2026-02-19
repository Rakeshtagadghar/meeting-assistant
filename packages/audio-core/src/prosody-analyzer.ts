import type { PcmFrame } from "./pcm-packetizer";

export interface ProsodyAnalyzerOptions {
  frameMs: number;
  windowSec: number;
  strideSec: number;
  minVoicedMs: number;
  minSnrDb: number;
  voicedEnergyThreshold: number;
}

export interface PacketProsodySnapshot {
  windowSec: number;
  strideSec: number;
  rmsEnergy: number;
  pauseRatio: number;
  voicedMs: number;
  snrDb: number;
  qualityPass: boolean;
  toneWeightsEnabled: boolean;
  confidencePenalty: number;
  clientEnergy: number | null;
  clientStress: number | null;
  clientCertainty: number | null;
}

interface FrameStats {
  capturedAtMs: number;
  rms: number;
  voiced: boolean;
}

export class RollingProsodyAnalyzer {
  private readonly options: ProsodyAnalyzerOptions;
  private readonly frameStats: FrameStats[] = [];
  private lastEmitAtMs: number | null = null;

  constructor(options: ProsodyAnalyzerOptions) {
    this.options = options;
  }

  pushFrame(frame: PcmFrame): PacketProsodySnapshot | null {
    const rms = normalizedRms(frame.samples);
    const voiced = rms >= this.options.voicedEnergyThreshold;
    this.frameStats.push({
      capturedAtMs: frame.capturedAtMs,
      rms,
      voiced,
    });
    this.trimWindow(frame.capturedAtMs);

    const strideMs = this.options.strideSec * 1_000;
    if (
      this.lastEmitAtMs !== null &&
      frame.capturedAtMs - this.lastEmitAtMs < strideMs
    ) {
      return null;
    }

    const snapshot = this.computeSnapshot();
    if (!snapshot) return null;
    this.lastEmitAtMs = frame.capturedAtMs;
    return snapshot;
  }

  reset(): void {
    this.frameStats.length = 0;
    this.lastEmitAtMs = null;
  }

  private trimWindow(nowMs: number): void {
    const minTs = nowMs - this.options.windowSec * 1_000;
    while (this.frameStats.length > 0) {
      const head = this.frameStats[0];
      if (!head || head.capturedAtMs >= minTs) break;
      this.frameStats.shift();
    }
  }

  private computeSnapshot(): PacketProsodySnapshot | null {
    if (this.frameStats.length === 0) return null;

    let voicedCount = 0;
    let rmsTotal = 0;
    let voicedRmsTotal = 0;
    let unvoicedRmsTotal = 0;
    let unvoicedCount = 0;

    for (const frame of this.frameStats) {
      rmsTotal += frame.rms;
      if (frame.voiced) {
        voicedCount += 1;
        voicedRmsTotal += frame.rms;
      } else {
        unvoicedCount += 1;
        unvoicedRmsTotal += frame.rms;
      }
    }

    const frameCount = this.frameStats.length;
    const voicedMs = voicedCount * this.options.frameMs;
    const pauseRatio = clamp01((frameCount - voicedCount) / frameCount);
    const rmsEnergy = clamp01(rmsTotal / frameCount);
    const signalRms =
      voicedCount > 0
        ? voicedRmsTotal / voicedCount
        : Math.max(0.0001, rmsTotal / frameCount);
    const noiseRms =
      unvoicedCount > 0
        ? Math.max(0.0001, unvoicedRmsTotal / unvoicedCount)
        : Math.max(0.0001, signalRms * 0.35);
    const snrDb = 20 * Math.log10((signalRms + 1e-6) / (noiseRms + 1e-6));

    const qualityPass =
      voicedMs >= this.options.minVoicedMs && snrDb >= this.options.minSnrDb;
    const toneWeightsEnabled = qualityPass;
    const confidencePenalty = qualityPass ? 0 : 0.2;

    return {
      windowSec: this.options.windowSec,
      strideSec: this.options.strideSec,
      rmsEnergy,
      pauseRatio,
      voicedMs,
      snrDb,
      qualityPass,
      toneWeightsEnabled,
      confidencePenalty,
      clientEnergy: qualityPass ? clamp01(rmsEnergy * 6) : null,
      clientStress: qualityPass
        ? clamp01(0.5 * pauseRatio + 0.4 * (1 - rmsEnergy))
        : null,
      clientCertainty: qualityPass ? clamp01(1 - pauseRatio * 0.7) : null,
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
  return Math.sqrt(meanSquare) / 32768;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
