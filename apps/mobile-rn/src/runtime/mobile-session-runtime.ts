import type {
  LiveAnalysisSnapshot,
  TranscriptChunk,
} from "@ainotes/shared-types";
import type { ServerToClientEvent } from "@ainotes/event-protocol";
import {
  MobileRealtimeClient,
  type MobileRealtimeClientOptions,
} from "../realtime/mobile-realtime-client";
import {
  MobileMicrophoneService,
  type NativePcmRecorder,
} from "../capture/mobile-microphone-service";
import { MobileSessionController } from "../session/mobile-session-controller";

export interface MobileSessionRuntimeState {
  connectionStatus: "idle" | "connecting" | "live" | "reconnecting";
  sessionState:
    | "ready"
    | "listening"
    | "paused"
    | "processing"
    | "stopped"
    | "error"
    | null;
  sessionMessage: string | null;
  liveAnalysisEnabled: boolean;
  partialText: string | null;
  partialSeq: number | null;
  transcript: TranscriptChunk[];
  latestAnalysis: LiveAnalysisSnapshot | null;
  lastAckedSeq: number;
}

export interface MobileSessionRuntimeOptions extends Omit<
  MobileRealtimeClientOptions,
  "onEvent" | "onStatus" | "onTerminalDisconnect"
> {
  recorder: NativePcmRecorder;
}

type RuntimeListener = (state: MobileSessionRuntimeState) => void;

function initialState(): MobileSessionRuntimeState {
  return {
    connectionStatus: "idle",
    sessionState: null,
    sessionMessage: null,
    liveAnalysisEnabled: false,
    partialText: null,
    partialSeq: null,
    transcript: [],
    latestAnalysis: null,
    lastAckedSeq: 0,
  };
}

export class MobileSessionRuntime {
  private readonly client: MobileRealtimeClient;
  private readonly microphone: MobileMicrophoneService;
  private readonly controller: MobileSessionController;

  private state: MobileSessionRuntimeState = initialState();
  private listeners = new Set<RuntimeListener>();
  private analysisTimer: ReturnType<typeof setInterval> | null = null;
  private stopInProgress = false;
  private terminalDisconnectHandled = false;

  constructor(options: MobileSessionRuntimeOptions) {
    this.client = new MobileRealtimeClient({
      ...options,
      onEvent: (event) => this.handleServerEvent(event),
      onStatus: (status) => this.patchState({ connectionStatus: status }),
      onTerminalDisconnect: () => {
        void this.handleTerminalDisconnect();
      },
    });
    this.microphone = new MobileMicrophoneService(
      options.recorder,
      this.client,
    );
    this.controller = new MobileSessionController(this.client, this.microphone);
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): MobileSessionRuntimeState {
    return this.state;
  }

  async start(args?: { liveAnalysisEnabled?: boolean }): Promise<void> {
    this.stopInProgress = false;
    this.terminalDisconnectHandled = false;
    await this.controller.start({
      liveAnalysisEnabled: args?.liveAnalysisEnabled ?? false,
    });
    this.patchState({
      liveAnalysisEnabled: args?.liveAnalysisEnabled ?? false,
      sessionState: "listening",
      sessionMessage: "Session started",
    });
    this.startAnalysisLoop();
  }

  async pause(): Promise<void> {
    await this.controller.pause();
    this.patchState({
      sessionState: "paused",
      sessionMessage: "Session paused",
    });
  }

  async resume(): Promise<void> {
    await this.controller.resume();
    this.patchState({
      sessionState: "listening",
      sessionMessage: "Session resumed",
    });
  }

  async stop(): Promise<void> {
    this.stopInProgress = true;
    try {
      await this.controller.stop();
      this.stopAnalysisLoop();
      this.patchState({
        connectionStatus: "idle",
        sessionState: "stopped",
        sessionMessage: "Session stopped",
        liveAnalysisEnabled: false,
        partialText: null,
        partialSeq: null,
      });
    } finally {
      this.stopInProgress = false;
    }
  }

  setLiveAnalysisEnabled(enabled: boolean): void {
    this.controller.setLiveAnalysisEnabled(enabled);
    this.patchState({
      liveAnalysisEnabled: enabled,
      latestAnalysis: enabled ? this.state.latestAnalysis : null,
    });
  }

  private startAnalysisLoop(): void {
    this.stopAnalysisLoop();
    const cadenceMs = this.controller.getAnalysisCadenceMs();
    this.analysisTimer = setInterval(() => {
      this.controller.maybeRunAnalysisTick(Date.now(), (contextWindowSec) => {
        this.client.triggerAnalysisTick(contextWindowSec);
      });
    }, cadenceMs);
  }

  private stopAnalysisLoop(): void {
    if (!this.analysisTimer) return;
    clearInterval(this.analysisTimer);
    this.analysisTimer = null;
  }

  private async handleTerminalDisconnect(): Promise<void> {
    if (this.stopInProgress) return;
    if (this.terminalDisconnectHandled) return;
    if (!this.controller.isRunning()) return;
    this.terminalDisconnectHandled = true;

    this.stopAnalysisLoop();
    await this.controller.handleTransportDisconnect();
    this.patchState({
      sessionState: "error",
      sessionMessage: "Connection lost. Streaming stopped.",
      liveAnalysisEnabled: false,
      latestAnalysis: null,
      partialSeq: null,
      partialText: null,
    });
  }

  private handleServerEvent(event: ServerToClientEvent): void {
    switch (event.type) {
      case "session.ack":
        this.patchState({
          lastAckedSeq: event.payload.lastAckedSeq,
        });
        break;

      case "session.status":
        this.patchState({
          sessionState: event.payload.state,
          sessionMessage: event.payload.message,
        });
        break;

      case "transcript.partial":
        this.patchState({
          partialSeq: event.payload.seq,
          partialText: event.payload.text,
        });
        break;

      case "transcript.committed":
        this.patchState({
          partialSeq:
            this.state.partialSeq === event.payload.seq
              ? null
              : this.state.partialSeq,
          partialText:
            this.state.partialSeq === event.payload.seq
              ? null
              : this.state.partialText,
          transcript: upsertCommittedChunk(this.state.transcript, {
            id: `${event.payload.meetingId}:${String(event.payload.seq)}`,
            sequence: event.payload.seq,
            tStartMs: event.payload.tStartMs,
            tEndMs: event.payload.tEndMs,
            speaker: event.payload.speaker,
            speakerRole: event.payload.speakerRole,
            audioSource: "microphone",
            text: event.payload.text,
            confidence: event.payload.confidence,
            prosody: {
              energy: null,
              pauseRatio: null,
              voicedMs: null,
              snrDb: null,
            },
            isFinal: true,
          }),
        });
        break;

      case "analysis.result":
        if (!this.state.liveAnalysisEnabled) {
          break;
        }
        this.patchState({
          latestAnalysis: event.payload.snapshot,
        });
        break;

      default:
        break;
    }
  }

  private patchState(next: Partial<MobileSessionRuntimeState>): void {
    this.state = {
      ...this.state,
      ...next,
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function upsertCommittedChunk(
  current: TranscriptChunk[],
  incoming: TranscriptChunk,
): TranscriptChunk[] {
  const index = current.findIndex(
    (item) => item.sequence === incoming.sequence,
  );
  if (index < 0) return [...current, incoming];
  const copy = [...current];
  copy[index] = incoming;
  return copy;
}
