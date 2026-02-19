import type { BufferedAudioPacket } from "./index";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export interface PcmFrame {
  samples: Int16Array;
  capturedAtMs: number;
}

export interface PcmPacketizerOptions {
  sampleRateHz: number;
  channels: number;
  packetMs: number;
  sequenceStart?: number;
}

export interface FlushOptions {
  nowMs?: number;
  isFinal?: boolean;
}

export class PcmPacketizer {
  private readonly samplesPerPacket: number;
  private readonly packetMs: number;

  private pending: Int16Array<ArrayBufferLike> = new Int16Array(0);
  private nextSequence: number;
  private nextStartMs: number | null = null;

  constructor(options: PcmPacketizerOptions) {
    this.samplesPerPacket = Math.max(
      1,
      Math.floor(
        (options.sampleRateHz * options.channels * options.packetMs) / 1000,
      ),
    );
    this.packetMs = options.packetMs;
    this.nextSequence = options.sequenceStart ?? 0;
  }

  pushFrame(frame: PcmFrame): BufferedAudioPacket[] {
    if (this.nextStartMs === null) {
      this.nextStartMs = frame.capturedAtMs;
    }

    this.pending = concatInt16(this.pending, frame.samples);

    const packets: BufferedAudioPacket[] = [];
    while (this.pending.length >= this.samplesPerPacket) {
      const packetSamples = this.pending.slice(0, this.samplesPerPacket);
      this.pending = this.pending.slice(this.samplesPerPacket);
      packets.push(this.makePacket(packetSamples, false));
    }
    return packets;
  }

  flush(options?: FlushOptions): BufferedAudioPacket[] {
    if (this.pending.length === 0) return [];
    const packet = this.makePacket(
      this.pending,
      options?.isFinal ?? true,
      options?.nowMs,
    );
    this.pending = new Int16Array(0);
    return [packet];
  }

  reset(nextSequence = 0): void {
    this.pending = new Int16Array(0);
    this.nextSequence = nextSequence;
    this.nextStartMs = null;
  }

  private makePacket(
    samples: Int16Array,
    isFinal: boolean,
    nowMs?: number,
  ): BufferedAudioPacket {
    const tStartMs = this.nextStartMs ?? nowMs ?? Date.now();
    const durationMs = this.estimateDurationMs(samples.length);
    const tEndMs = tStartMs + durationMs;
    this.nextStartMs = isFinal ? null : tEndMs;

    return {
      seq: this.nextSequence++,
      tStartMs,
      tEndMs,
      audioBase64: base64FromInt16LE(samples),
      isFinal,
    };
  }

  private estimateDurationMs(sampleCount: number): number {
    const ratio = sampleCount / this.samplesPerPacket;
    return Math.max(20, Math.round(this.packetMs * ratio));
  }
}

function concatInt16(a: Int16Array, b: Int16Array): Int16Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Int16Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function base64FromInt16LE(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  let offset = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] ?? 0;
    bytes[offset++] = value & 0xff;
    bytes[offset++] = (value >>> 8) & 0xff;
  }
  return base64FromBytes(bytes);
}

function base64FromBytes(bytes: Uint8Array): string {
  let output = "";
  let i = 0;

  while (i < bytes.length) {
    const a = bytes[i++] ?? 0;
    const b = bytes[i++] ?? 0;
    const c = bytes[i++] ?? 0;

    const triple = (a << 16) | (b << 8) | c;
    output += BASE64_ALPHABET[(triple >> 18) & 0x3f] ?? "=";
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f] ?? "=";
    output +=
      i - 1 > bytes.length
        ? "="
        : (BASE64_ALPHABET[(triple >> 6) & 0x3f] ?? "=");
    output += i > bytes.length ? "=" : (BASE64_ALPHABET[triple & 0x3f] ?? "=");
  }

  const mod = bytes.length % 3;
  if (mod === 1) {
    return `${output.slice(0, -2)}==`;
  }
  if (mod === 2) {
    return `${output.slice(0, -1)}=`;
  }
  return output;
}
