import {
  EnergyVadSegmenter,
  PcmPacketizer,
  RollingProsodyAnalyzer,
  type PacketProsodySnapshot,
  type PcmFrame,
} from "@ainotes/audio-core";
import {
  MOBILE_AUDIO_SPEC,
  MOBILE_PROSODY_POLICY,
  MOBILE_VAD_POLICY,
} from "../mobile-spec";
import type { MobileRealtimeClient } from "../realtime/mobile-realtime-client";

export interface NativeRecorderStartOptions {
  sampleRateHz: number;
  channels: number;
  frameMs: number;
}

export type NativeRecorderFrameHandler = (frame: PcmFrame) => void;

export interface NativePcmRecorder {
  start(
    options: NativeRecorderStartOptions,
    onFrame: NativeRecorderFrameHandler,
  ): Promise<void> | void;
  stop(): Promise<void> | void;
  pause?(): Promise<void> | void;
  resume?(): Promise<void> | void;
}

export class MobileMicrophoneService {
  private readonly recorder: NativePcmRecorder;
  private readonly client: MobileRealtimeClient;
  private readonly packetizer = new PcmPacketizer({
    sampleRateHz: MOBILE_AUDIO_SPEC.sampleRateHz,
    channels: MOBILE_AUDIO_SPEC.channels,
    packetMs: MOBILE_AUDIO_SPEC.packetMs,
  });
  private readonly vadSegmenter = new EnergyVadSegmenter({
    frameMs: MOBILE_AUDIO_SPEC.frameMs,
    minSpeechMs: MOBILE_VAD_POLICY.minSpeechMs,
    finalizeOnSilenceMs: MOBILE_VAD_POLICY.finalizeOnSilenceMs,
    dropSilenceFrames: !MOBILE_VAD_POLICY.dropSilenceChunks ? false : true,
    energyThreshold: MOBILE_VAD_POLICY.energyThreshold,
  });
  private readonly prosodyAnalyzer = new RollingProsodyAnalyzer({
    frameMs: MOBILE_AUDIO_SPEC.frameMs,
    windowSec: MOBILE_PROSODY_POLICY.windowSec,
    strideSec: MOBILE_PROSODY_POLICY.strideSec,
    minVoicedMs: MOBILE_PROSODY_POLICY.minVoicedMs,
    minSnrDb: MOBILE_PROSODY_POLICY.minSnrDb,
    voicedEnergyThreshold: MOBILE_PROSODY_POLICY.voicedEnergyThreshold,
  });
  private active = false;
  private latestProsody: PacketProsodySnapshot | null = null;

  constructor(recorder: NativePcmRecorder, client: MobileRealtimeClient) {
    this.recorder = recorder;
    this.client = client;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.latestProsody = null;
    this.prosodyAnalyzer.reset();

    await this.recorder.start(
      {
        sampleRateHz: MOBILE_AUDIO_SPEC.sampleRateHz,
        channels: MOBILE_AUDIO_SPEC.channels,
        frameMs: MOBILE_AUDIO_SPEC.frameMs,
      },
      (frame) => {
        if (MOBILE_PROSODY_POLICY.enabled) {
          const prosodySnapshot = this.prosodyAnalyzer.pushFrame(frame);
          if (prosodySnapshot) {
            this.latestProsody = prosodySnapshot;
          }
        }

        if (!MOBILE_VAD_POLICY.enabled) {
          this.emitPackets(this.packetizer.pushFrame(frame));
          return;
        }

        const vadResult = this.vadSegmenter.pushFrame(frame);
        for (const speechFrame of vadResult.emitFrames) {
          this.emitPackets(this.packetizer.pushFrame(speechFrame));
        }

        if (vadResult.finalizeUtterance) {
          this.emitPackets(this.packetizer.flush({ isFinal: true }));
        }
      },
    );
  }

  async pause(): Promise<void> {
    await this.recorder.pause?.();
  }

  async resume(): Promise<void> {
    await this.recorder.resume?.();
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    if (MOBILE_VAD_POLICY.enabled) {
      const vadFlush = this.vadSegmenter.flush();
      if (vadFlush.finalizeUtterance) {
        this.emitPackets(this.packetizer.flush({ isFinal: true }));
      }
    }
    this.emitPackets(this.packetizer.flush({ isFinal: true }));
    this.latestProsody = null;
    this.prosodyAnalyzer.reset();
    await this.recorder.stop();
  }

  private emitPackets(packets: ReturnType<PcmPacketizer["pushFrame"]>): void {
    for (const packet of packets) {
      const prosody = this.latestProsody
        ? { ...this.latestProsody }
        : undefined;
      this.client.queueAudioPacket(prosody ? { ...packet, prosody } : packet);
    }
  }
}
