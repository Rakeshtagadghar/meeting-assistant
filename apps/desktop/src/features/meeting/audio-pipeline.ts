import type { CaptureMode } from "./consent";

export interface AudioFormat {
  sampleRateHz: number;
  channels: number;
  pcm: "s16le";
}

export interface AudioPipelineOptions {
  micGain?: number;
  systemGain?: number;
  silenceFloorDb?: number;
}

export interface MixResult {
  samples: Float32Array;
  limiterEngaged: boolean;
  maxAmplitude: number;
  activeSources: Array<"microphone" | "system_output">;
}

export const TARGET_AUDIO_FORMAT: AudioFormat = {
  sampleRateHz: 16_000,
  channels: 1,
  pcm: "s16le",
};

const DEFAULT_MIC_GAIN = 1.0;
const DEFAULT_SYSTEM_GAIN = 1.0;

export function resampleTo16kMono(
  input: Float32Array,
  inputSampleRate: number,
  channels: number,
): Float32Array {
  if (channels < 1) {
    throw new Error("channels must be >= 1");
  }

  const mono = toMono(input, channels);

  if (inputSampleRate === TARGET_AUDIO_FORMAT.sampleRateHz) {
    return mono;
  }

  const ratio = inputSampleRate / TARGET_AUDIO_FORMAT.sampleRateHz;
  const outLen = Math.max(1, Math.round(mono.length / ratio));
  const out = new Float32Array(outLen);

  for (let i = 0; i < outLen; i += 1) {
    const sourceIndex = Math.min(mono.length - 1, Math.round(i * ratio));
    out[i] = mono[sourceIndex] ?? 0;
  }

  return out;
}

export function mixMeetingAudio(
  mic: Float32Array | null,
  system: Float32Array | null,
  options: AudioPipelineOptions = {},
): MixResult {
  const micGain = options.micGain ?? DEFAULT_MIC_GAIN;
  const systemGain = options.systemGain ?? DEFAULT_SYSTEM_GAIN;

  const frames = Math.max(mic?.length ?? 0, system?.length ?? 0);
  const mixed = new Float32Array(frames);

  const micRms = calculateRms(mic);
  const systemRms = calculateRms(system);

  for (let i = 0; i < frames; i += 1) {
    const micSample = (mic?.[i] ?? 0) * micGain * autoGainForRms(micRms);
    const systemSample =
      (system?.[i] ?? 0) * systemGain * autoGainForRms(systemRms);

    mixed[i] = micSample + systemSample;
  }

  let limiterEngaged = false;
  let maxAmplitude = 0;

  for (let i = 0; i < mixed.length; i += 1) {
    if (Math.abs(mixed[i]) > 1.0) {
      limiterEngaged = true;
      mixed[i] = Math.max(-1.0, Math.min(1.0, mixed[i]));
    }
    maxAmplitude = Math.max(maxAmplitude, Math.abs(mixed[i]));
  }

  const activeSources: Array<"microphone" | "system_output"> = [];
  if (micRms > 0.001) {
    activeSources.push("microphone");
  }
  if (systemRms > 0.001) {
    activeSources.push("system_output");
  }

  return {
    samples: mixed,
    limiterEngaged,
    maxAmplitude,
    activeSources,
  };
}

export function resolveCaptureMode(
  requestedMode: CaptureMode,
  isSystemOutputAvailable: boolean,
): { mode: CaptureMode; warning: string | null } {
  if (requestedMode === "mixed" && !isSystemOutputAvailable) {
    return {
      mode: "mic_only",
      warning:
        "System audio capture unavailable. Falling back to microphone only.",
    };
  }

  return { mode: requestedMode, warning: null };
}

function toMono(input: Float32Array, channels: number): Float32Array {
  if (channels === 1) {
    return input;
  }

  const frameCount = Math.floor(input.length / channels);
  const out = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += input[frame * channels + channel] ?? 0;
    }
    out[frame] = sum / channels;
  }

  return out;
}

function calculateRms(input: Float32Array | null): number {
  if (!input || input.length === 0) {
    return 0;
  }

  const sumSquares = input.reduce((acc, sample) => acc + sample * sample, 0);
  return Math.sqrt(sumSquares / input.length);
}

function autoGainForRms(rms: number): number {
  if (rms <= 0) {
    return 1;
  }

  return rms < 0.08 ? 1.2 : 1;
}
