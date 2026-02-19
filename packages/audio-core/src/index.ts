import type { PacketProsodySnapshot } from "./prosody-analyzer";

export const AUDIO_SAMPLE_RATE_HZ = 16_000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_ENCODING = "pcm_s16le";
export const AUDIO_FRAME_MS = 20;
export const AUDIO_PACKET_MS = 1_000;
export const AUDIO_MAX_BUFFERED_MS = 5_000;

export interface BufferedAudioPacket {
  seq: number;
  tStartMs: number;
  tEndMs: number;
  audioBase64: string;
  isFinal: boolean;
  prosody?: PacketProsodySnapshot;
}

export type {
  FlushOptions,
  PcmFrame,
  PcmPacketizerOptions,
} from "./pcm-packetizer";
export { PcmPacketizer } from "./pcm-packetizer";
export type {
  EnergyVadSegmenterOptions,
  VadSegmenterResult,
} from "./energy-vad-segmenter";
export { EnergyVadSegmenter } from "./energy-vad-segmenter";
export type {
  PacketProsodySnapshot,
  ProsodyAnalyzerOptions,
} from "./prosody-analyzer";
export { RollingProsodyAnalyzer } from "./prosody-analyzer";

export interface RealtimeAudioBufferOptions {
  maxBufferedMs: number;
}

export class RealtimeAudioBuffer {
  private readonly maxBufferedMs: number;
  private readonly queue: BufferedAudioPacket[] = [];
  private bufferedMs = 0;

  constructor(options?: Partial<RealtimeAudioBufferOptions>) {
    this.maxBufferedMs = options?.maxBufferedMs ?? AUDIO_MAX_BUFFERED_MS;
  }

  push(packet: BufferedAudioPacket): void {
    this.queue.push(packet);
    this.bufferedMs += this.packetDuration(packet);
    this.trimToBudget();
  }

  drainAll(): BufferedAudioPacket[] {
    const drained = [...this.queue];
    this.queue.length = 0;
    this.bufferedMs = 0;
    return drained;
  }

  size(): number {
    return this.queue.length;
  }

  totalBufferedMs(): number {
    return this.bufferedMs;
  }

  private trimToBudget(): void {
    while (this.bufferedMs > this.maxBufferedMs && this.queue.length > 0) {
      const partialIndex = this.queue.findIndex((item) => !item.isFinal);
      const removeIndex = partialIndex >= 0 ? partialIndex : 0;
      const removed = this.queue.splice(removeIndex, 1)[0];
      if (!removed) break;
      this.bufferedMs = Math.max(
        0,
        this.bufferedMs - this.packetDuration(removed),
      );
    }
  }

  private packetDuration(packet: BufferedAudioPacket): number {
    return Math.max(0, packet.tEndMs - packet.tStartMs);
  }
}
