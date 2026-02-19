import { MOBILE_ANALYSIS_POLICY } from "../mobile-spec";
import type { MobileRealtimeClient } from "../realtime/mobile-realtime-client";
import type { MobileMicrophoneService } from "../capture/mobile-microphone-service";

export interface MobileSessionStartOptions {
  liveAnalysisEnabled?: boolean;
}

export class MobileSessionController {
  private readonly client: MobileRealtimeClient;
  private readonly microphone: MobileMicrophoneService;
  private running = false;
  private liveAnalysisEnabled = false;
  private analysisWarmupPending = false;

  constructor(
    client: MobileRealtimeClient,
    microphone: MobileMicrophoneService,
  ) {
    this.client = client;
    this.microphone = microphone;
  }

  async start(options?: MobileSessionStartOptions): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.client.connect();
    this.client.startSession();
    this.setLiveAnalysisEnabled(options?.liveAnalysisEnabled ?? false);
    await this.microphone.start();
  }

  async pause(): Promise<void> {
    if (!this.running) return;
    await this.microphone.pause();
  }

  async resume(): Promise<void> {
    if (!this.running) return;
    await this.microphone.resume();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.analysisWarmupPending = false;
    this.liveAnalysisEnabled = false;
    await this.microphone.stop();
    this.client.disconnect("session-stop");
  }

  async handleTransportDisconnect(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.analysisWarmupPending = false;
    this.liveAnalysisEnabled = false;
    await this.microphone.stop();
  }

  setLiveAnalysisEnabled(enabled: boolean): void {
    this.liveAnalysisEnabled = enabled;
    if (enabled) {
      this.analysisWarmupPending = true;
    }
    this.client.setLiveAnalysisEnabled(enabled);
  }

  maybeRunAnalysisTick(
    nowMs: number,
    onTick: (contextWindowSec: number) => void,
  ): void {
    if (!this.running) return;
    if (!this.liveAnalysisEnabled) return;
    if (!this.client.canRunAnalysis(nowMs)) return;
    this.client.markAnalysisTick(nowMs);
    onTick(this.consumeAnalysisContextWindowSec());
  }

  getAnalysisCadenceMs(): number {
    return MOBILE_ANALYSIS_POLICY.cadenceMs;
  }

  isRunning(): boolean {
    return this.running;
  }

  private consumeAnalysisContextWindowSec(): number {
    if (this.analysisWarmupPending) {
      this.analysisWarmupPending = false;
      return MOBILE_ANALYSIS_POLICY.warmupContextSec;
    }
    return MOBILE_ANALYSIS_POLICY.defaultContextSec;
  }
}
