import {
  DEFAULT_RECONNECT_POLICY,
  makeClientEvent,
  type ClientToServerEvent,
  type ReconnectPolicy,
  type ServerToClientEvent,
} from "@ainotes/event-protocol";
import {
  RealtimeAudioBuffer,
  type BufferedAudioPacket,
} from "@ainotes/audio-core";
import { createLiveAnalysisGate } from "@ainotes/live-analysis-core";
import { parseServerEventEnvelope } from "@ainotes/validation-schemas";
import {
  MOBILE_ANALYSIS_POLICY,
  MOBILE_AUDIO_SPEC,
  MOBILE_STREAMING_POLICY,
} from "../mobile-spec";

export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = (url: string) => SocketLike;

const SOCKET_OPEN = 1;

export interface MobileRealtimeClientOptions {
  url: string;
  meetingId: string;
  language?: string;
  createSocket: SocketFactory;
  reconnectPolicy?: ReconnectPolicy;
  onEvent?: (event: ServerToClientEvent) => void;
  onStatus?: (status: "idle" | "connecting" | "live" | "reconnecting") => void;
  onTerminalDisconnect?: () => void;
}

export class MobileRealtimeClient {
  private readonly options: MobileRealtimeClientOptions;
  private readonly reconnectPolicy: ReconnectPolicy;
  private readonly audioBuffer = new RealtimeAudioBuffer({
    maxBufferedMs: MOBILE_STREAMING_POLICY.maxBufferedMs,
  });
  private readonly analysisGate = createLiveAnalysisGate();

  private socket: SocketLike | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private sessionStarted = false;
  private analysisEnabled = false;
  private lastAckedSeq = 0;

  constructor(options: MobileRealtimeClientOptions) {
    this.options = options;
    this.reconnectPolicy = options.reconnectPolicy ?? DEFAULT_RECONNECT_POLICY;
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.openSocket("connecting");
  }

  disconnect(reason = "client-stop"): void {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    this.sessionStarted = false;
    this.analysisEnabled = false;
    this.analysisGate.setEnabled(false);
    this.send({
      type: "session.stop",
      payload: {
        meetingId: this.options.meetingId,
        reason,
      },
    } as const);
    this.socket?.close(1000, reason);
    this.socket = null;
    this.options.onStatus?.("idle");
  }

  startSession(): void {
    this.sessionStarted = true;
    this.syncSessionStateToSocket();
  }

  setLiveAnalysisEnabled(enabled: boolean): void {
    this.analysisEnabled = enabled;
    this.analysisGate.setEnabled(enabled);
    this.send({
      type: "analysis.toggle",
      payload: {
        meetingId: this.options.meetingId,
        enabled,
      },
    } as const);
  }

  queueAudioPacket(packet: BufferedAudioPacket): void {
    this.audioBuffer.push(packet);
    this.flushAudioPackets();
  }

  canRunAnalysis(nowMs: number): boolean {
    return this.analysisGate.shouldRun(nowMs);
  }

  markAnalysisTick(nowMs: number): void {
    this.analysisGate.markRun(nowMs);
  }

  triggerAnalysisTick(contextWindowSec: number): void {
    this.send({
      type: "analysis.tick",
      payload: {
        meetingId: this.options.meetingId,
        deltaWindowSec: MOBILE_ANALYSIS_POLICY.deltaWindowSec,
        contextWindowSec,
        mode: "deep",
      },
    } as const);
  }

  getLastAckedSeq(): number {
    return this.lastAckedSeq;
  }

  private openSocket(status: "connecting" | "reconnecting"): void {
    this.options.onStatus?.(status);
    const socket = this.options.createSocket(this.options.url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.options.onStatus?.("live");
      this.syncSessionStateToSocket();
      this.flushAudioPackets();
    };

    socket.onmessage = (event) => {
      this.handleIncoming(event.data);
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.intentionallyClosed) return;
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      this.socket?.close(1011, "socket-error");
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.reconnectPolicy.maxRetries) {
      this.options.onStatus?.("idle");
      this.options.onTerminalDisconnect?.();
      return;
    }

    const retryIndex = Math.min(
      this.reconnectAttempts,
      this.reconnectPolicy.backoffMs.length - 1,
    );
    const delayMs = this.reconnectPolicy.backoffMs[retryIndex] ?? 8_000;
    this.reconnectAttempts += 1;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.openSocket("reconnecting");
    }, delayMs);
  }

  private syncSessionStateToSocket(): void {
    if (!this.sessionStarted) return;

    this.send({
      type: "session.start",
      payload: {
        meetingId: this.options.meetingId,
        language: this.options.language ?? "auto",
        sampleRateHz: MOBILE_AUDIO_SPEC.sampleRateHz,
        channels: MOBILE_AUDIO_SPEC.channels,
        encoding: MOBILE_AUDIO_SPEC.encoding,
      },
    } as const);

    this.send({
      type: "session.resume",
      payload: {
        meetingId: this.options.meetingId,
        lastAckedSeq: this.lastAckedSeq,
      },
    } as const);

    this.send({
      type: "analysis.toggle",
      payload: {
        meetingId: this.options.meetingId,
        enabled: this.analysisEnabled,
      },
    } as const);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private flushAudioPackets(): void {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) return;

    const packets = this.audioBuffer.drainAll();
    for (const packet of packets) {
      this.send({
        type: "audio.packet",
        payload: {
          meetingId: this.options.meetingId,
          seq: packet.seq,
          tStartMs: packet.tStartMs,
          tEndMs: packet.tEndMs,
          audioSource: "microphone",
          encoding: "pcm_s16le",
          audioBase64: packet.audioBase64,
          isFinal: packet.isFinal,
          prosody: packet.prosody,
        },
      } as const);
    }
  }

  private handleIncoming(raw: string): void {
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return;
    }

    const event = parseServerEventEnvelope(parsed);
    if (!event) return;

    if (event.type === "session.ack") {
      this.lastAckedSeq = Math.max(
        this.lastAckedSeq,
        event.payload.lastAckedSeq,
      );
    }
    this.options.onEvent?.(event);
  }

  private send(event: Omit<ClientToServerEvent, "protocolVersion">): void {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) return;
    this.socket.send(JSON.stringify(makeClientEvent(event)));
  }
}
