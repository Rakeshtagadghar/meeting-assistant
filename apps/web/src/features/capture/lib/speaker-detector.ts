/**
 * Lightweight speaker change detection using audio voice fingerprints.
 *
 * Instead of relying on silence gaps (same speaker can pause for seconds),
 * this compares acoustic features between speech segments:
 * - Fundamental frequency (F0/pitch) via autocorrelation
 * - Spectral centroid (brightness of voice)
 * - RMS energy contour
 *
 * These features create a simple voice "fingerprint" that distinguishes
 * speakers without needing a neural network model.
 */

interface SpeakerProfile {
  /** Average fundamental frequency in Hz */
  avgF0: number;
  /** Average spectral centroid in Hz */
  avgCentroid: number;
  /** Number of segments used to build this profile */
  segmentCount: number;
}

interface VoiceFeatures {
  f0: number;
  centroid: number;
}

const MAX_SPEAKERS = 4;

/**
 * Similarity threshold (0-1) — below this, voices are considered different speakers.
 * Tuned for typical meeting scenarios (2-4 speakers).
 */
const SIMILARITY_THRESHOLD = 0.75;

export class SpeakerDetector {
  private profiles: Map<string, SpeakerProfile> = new Map();
  private speakerCounter = 0;

  /**
   * Analyze an audio segment and return the detected speaker label.
   * Compares voice characteristics against known speaker profiles.
   */
  detect(audio: Float32Array, sampleRate: number): string {
    const features = this.extractFeatures(audio, sampleRate);

    // Skip detection if we couldn't extract meaningful features
    if (features.f0 === 0 && features.centroid === 0) {
      // Return the most recent speaker or Speaker 1
      return this.profiles.size > 0
        ? `Speaker ${this.speakerCounter || 1}`
        : "Speaker 1";
    }

    // Find best matching speaker profile
    let bestLabel = "";
    let bestSimilarity = 0;

    for (const [label, profile] of this.profiles) {
      const sim = this.similarity(features, profile);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestLabel = label;
      }
    }

    if (bestSimilarity >= SIMILARITY_THRESHOLD && bestLabel) {
      // Update existing profile with running average
      const profile = this.profiles.get(bestLabel)!;
      const n = profile.segmentCount;
      profile.avgF0 = (profile.avgF0 * n + features.f0) / (n + 1);
      profile.avgCentroid =
        (profile.avgCentroid * n + features.centroid) / (n + 1);
      profile.segmentCount++;
      return bestLabel;
    }

    // New speaker detected (or first speaker)
    if (this.profiles.size < MAX_SPEAKERS) {
      this.speakerCounter++;
      const label = `Speaker ${this.speakerCounter}`;
      this.profiles.set(label, {
        avgF0: features.f0,
        avgCentroid: features.centroid,
        segmentCount: 1,
      });
      return label;
    }

    // Max speakers reached — assign to closest existing profile
    return bestLabel || "Speaker 1";
  }

  reset(): void {
    this.profiles.clear();
    this.speakerCounter = 0;
  }

  // ─── Feature Extraction ───

  private extractFeatures(
    audio: Float32Array,
    sampleRate: number,
  ): VoiceFeatures {
    // Use a centered window of the audio (skip edges which may have silence)
    const quarter = Math.floor(audio.length / 4);
    const segment = audio.subarray(quarter, audio.length - quarter);

    if (segment.length < 512) {
      return { f0: 0, centroid: 0 };
    }

    const f0 = this.estimateF0(segment, sampleRate);
    const centroid = this.spectralCentroid(segment, sampleRate);

    return { f0, centroid };
  }

  /**
   * Estimate fundamental frequency using autocorrelation.
   * Looks for the dominant pitch in the 80-400 Hz range (human voice).
   */
  private estimateF0(samples: Float32Array, sampleRate: number): number {
    // Pitch search range
    const minPeriod = Math.floor(sampleRate / 400); // 400 Hz max
    const maxPeriod = Math.floor(sampleRate / 80); // 80 Hz min
    const frameSize = Math.min(samples.length, maxPeriod * 2);

    if (frameSize < maxPeriod) return 0;

    // Use the middle portion for stability
    const start = Math.floor((samples.length - frameSize) / 2);
    const frame = samples.subarray(start, start + frameSize);

    // Normalized autocorrelation
    let bestCorrelation = 0;
    let bestPeriod = 0;

    // Compute energy of the frame
    let energy = 0;
    for (let i = 0; i < frameSize; i++) {
      energy += frame[i]! * frame[i]!;
    }
    if (energy < 1e-6) return 0; // Silence

    for (
      let period = minPeriod;
      period <= maxPeriod && period < frameSize;
      period++
    ) {
      let correlation = 0;
      let energy1 = 0;
      let energy2 = 0;
      const len = frameSize - period;

      for (let i = 0; i < len; i++) {
        correlation += frame[i]! * frame[i + period]!;
        energy1 += frame[i]! * frame[i]!;
        energy2 += frame[i + period]! * frame[i + period]!;
      }

      const denom = Math.sqrt(energy1 * energy2);
      if (denom < 1e-10) continue;

      const normalizedCorr = correlation / denom;

      if (normalizedCorr > bestCorrelation) {
        bestCorrelation = normalizedCorr;
        bestPeriod = period;
      }
    }

    // Only accept if correlation is strong enough (voiced speech)
    if (bestCorrelation < 0.3 || bestPeriod === 0) return 0;

    return sampleRate / bestPeriod;
  }

  /**
   * Compute spectral centroid — the "center of mass" of the spectrum.
   * Higher values = brighter/sharper voice.
   */
  private spectralCentroid(samples: Float32Array, sampleRate: number): number {
    // Use a power-of-2 FFT size
    const fftSize = 1024;
    if (samples.length < fftSize) return 0;

    // Take a window from the middle
    const start = Math.floor((samples.length - fftSize) / 2);
    const frame = samples.subarray(start, start + fftSize);

    // Apply Hann window
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      windowed[i] = frame[i]! * hann;
    }

    // Compute magnitude spectrum via DFT (only need first half)
    // For efficiency, compute only the magnitudes we need
    const halfSize = fftSize / 2;
    const magnitudes = new Float32Array(halfSize);

    for (let k = 0; k < halfSize; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        re += windowed[n]! * Math.cos(angle);
        im -= windowed[n]! * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(re * re + im * im);
    }

    // Compute centroid = sum(f * mag) / sum(mag)
    let weightedSum = 0;
    let totalMag = 0;
    const freqPerBin = sampleRate / fftSize;

    for (let k = 1; k < halfSize; k++) {
      const freq = k * freqPerBin;
      const mag = magnitudes[k]!;
      weightedSum += freq * mag;
      totalMag += mag;
    }

    return totalMag > 0 ? weightedSum / totalMag : 0;
  }

  // ─── Similarity ───

  /**
   * Compute similarity between voice features and a speaker profile.
   * Returns 0-1 where 1 = identical.
   */
  private similarity(features: VoiceFeatures, profile: SpeakerProfile): number {
    // F0 similarity: Gaussian-like, with 30Hz tolerance
    const f0Diff = Math.abs(features.f0 - profile.avgF0);
    const f0Sim = Math.exp(-(f0Diff * f0Diff) / (2 * 30 * 30));

    // Centroid similarity: Gaussian-like, with 200Hz tolerance
    const centDiff = Math.abs(features.centroid - profile.avgCentroid);
    const centSim = Math.exp(-(centDiff * centDiff) / (2 * 200 * 200));

    // Weighted combination (pitch is more discriminative)
    return 0.6 * f0Sim + 0.4 * centSim;
  }
}
