import {
  makeServerEvent,
  type ClientToServerEvent,
  type ServerToClientEvent,
} from "@ainotes/event-protocol";
import { parseClientEventEnvelope } from "@ainotes/validation-schemas";
import type { SocketFactory, SocketLike } from "./mobile-realtime-client";

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

export interface LoopbackSocketOptions {
  openDelayMs?: number;
  ackDelayMs?: number;
  transcriptEveryPackets?: number;
}

export function createLoopbackMockSocketFactory(
  options?: LoopbackSocketOptions,
): SocketFactory {
  return () => new LoopbackMockSocket(options);
}

class LoopbackMockSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  private mutableReadyState = SOCKET_CONNECTING;
  private readonly ackDelayMs: number;
  private readonly transcriptEveryPackets: number;
  private packetCounter = 0;

  constructor(options?: LoopbackSocketOptions) {
    this.ackDelayMs = options?.ackDelayMs ?? 100;
    this.transcriptEveryPackets = Math.max(
      1,
      options?.transcriptEveryPackets ?? 2,
    );
    const openDelayMs = options?.openDelayMs ?? 10;

    setTimeout(() => {
      if (this.mutableReadyState === SOCKET_CLOSED) return;
      this.mutableReadyState = SOCKET_OPEN;
      this.onopen?.();
    }, openDelayMs);
  }

  get readyState(): number {
    return this.mutableReadyState;
  }

  send(data: string): void {
    if (this.mutableReadyState !== SOCKET_OPEN) return;

    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      this.onerror?.();
      return;
    }

    const event = parseClientEventEnvelope(parsed);
    if (!event) return;
    this.handleClientEvent(event);
  }

  close(code?: number, reason?: string): void {
    if (this.mutableReadyState === SOCKET_CLOSED) return;
    this.mutableReadyState = SOCKET_CLOSED;
    this.onclose?.({ code, reason });
  }

  private handleClientEvent(event: ClientToServerEvent): void {
    switch (event.type) {
      case "session.start":
        this.emitServer({
          type: "session.status",
          payload: {
            meetingId: event.payload.meetingId,
            state: "listening",
            message: "Mock session listening",
          },
        });
        break;

      case "session.resume":
        setTimeout(() => {
          this.emitServer({
            type: "session.ack",
            payload: {
              meetingId: event.payload.meetingId,
              lastAckedSeq: event.payload.lastAckedSeq,
            },
          });
        }, this.ackDelayMs);
        break;

      case "audio.packet":
        this.packetCounter += 1;
        if (this.packetCounter % this.transcriptEveryPackets === 0) {
          this.emitServer({
            type: "transcript.committed",
            payload: {
              meetingId: event.payload.meetingId,
              seq: event.payload.seq,
              tStartMs: event.payload.tStartMs,
              tEndMs: event.payload.tEndMs,
              speaker: "Speaker 1",
              speakerRole: "MIXED",
              text: `Mock transcript chunk #${String(event.payload.seq)}`,
              confidence: 0.78,
            },
          });
        } else {
          this.emitServer({
            type: "transcript.partial",
            payload: {
              meetingId: event.payload.meetingId,
              seq: event.payload.seq,
              tStartMs: event.payload.tStartMs,
              speaker: "Speaker 1",
              speakerRole: "MIXED",
              text: `Mock partial #${String(event.payload.seq)}`,
            },
          });
        }
        break;

      case "analysis.tick":
        this.emitServer({
          type: "analysis.result",
          payload: {
            meetingId: event.payload.meetingId,
            snapshot: {
              meetingId: event.payload.meetingId,
              generatedAtMs: Date.now(),
              callHealth: 72,
              callHealthConfidence: 0.68,
              clientValence: 0.15,
              clientEngagement: 0.59,
              riskFlags: ["timingObjection"],
            },
          },
        });
        break;

      default:
        break;
    }
  }

  private emitServer(
    event: Omit<ServerToClientEvent, "protocolVersion">,
  ): void {
    if (this.mutableReadyState !== SOCKET_OPEN) return;
    const message = JSON.stringify(makeServerEvent(event));
    this.onmessage?.({ data: message });
  }
}
