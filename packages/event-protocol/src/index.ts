import type {
  CaptureAudioSource,
  LiveAnalysisSnapshot,
  SpeakerRole,
} from "@ainotes/shared-types";

export const EVENT_PROTOCOL_VERSION = "2026-02-18.mobile-v1";

export interface ReconnectPolicy {
  maxRetries: number;
  backoffMs: readonly number[];
}

export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = Object.freeze({
  maxRetries: 12,
  backoffMs: [250, 500, 1_000, 2_000, 4_000, 8_000],
});

export interface ClientEventEnvelope<
  TType extends string,
  TPayload extends Record<string, unknown>,
> {
  protocolVersion: typeof EVENT_PROTOCOL_VERSION;
  type: TType;
  payload: TPayload;
}

export interface ServerEventEnvelope<
  TType extends string,
  TPayload extends Record<string, unknown>,
> {
  protocolVersion: typeof EVENT_PROTOCOL_VERSION;
  type: TType;
  payload: TPayload;
}

export type SessionStartEvent = ClientEventEnvelope<
  "session.start",
  {
    meetingId: string;
    language: string;
    sampleRateHz: number;
    channels: number;
    encoding: "pcm_s16le";
  }
>;

export type SessionStopEvent = ClientEventEnvelope<
  "session.stop",
  {
    meetingId: string;
    reason: string;
  }
>;

export type SessionResumeEvent = ClientEventEnvelope<
  "session.resume",
  {
    meetingId: string;
    lastAckedSeq: number;
  }
>;

export type AnalysisToggleEvent = ClientEventEnvelope<
  "analysis.toggle",
  {
    meetingId: string;
    enabled: boolean;
  }
>;

export type AnalysisTickEvent = ClientEventEnvelope<
  "analysis.tick",
  {
    meetingId: string;
    deltaWindowSec: number;
    contextWindowSec: number;
    mode: "deep";
  }
>;

export interface AudioPacketProsody {
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

export type AudioPacketEvent = ClientEventEnvelope<
  "audio.packet",
  {
    meetingId: string;
    seq: number;
    tStartMs: number;
    tEndMs: number;
    audioSource: Extract<CaptureAudioSource, "microphone">;
    encoding: "pcm_s16le";
    audioBase64: string;
    isFinal: boolean;
    prosody?: AudioPacketProsody;
  }
>;

export type ClientToServerEvent =
  | SessionStartEvent
  | SessionStopEvent
  | SessionResumeEvent
  | AnalysisToggleEvent
  | AnalysisTickEvent
  | AudioPacketEvent;

export type SessionAckEvent = ServerEventEnvelope<
  "session.ack",
  {
    meetingId: string;
    lastAckedSeq: number;
  }
>;

export type TranscriptPartialEvent = ServerEventEnvelope<
  "transcript.partial",
  {
    meetingId: string;
    seq: number;
    tStartMs: number;
    speaker: string | null;
    speakerRole: SpeakerRole;
    text: string;
  }
>;

export type TranscriptCommittedEvent = ServerEventEnvelope<
  "transcript.committed",
  {
    meetingId: string;
    seq: number;
    tStartMs: number;
    tEndMs: number;
    speaker: string | null;
    speakerRole: SpeakerRole;
    text: string;
    confidence: number | null;
  }
>;

export type AnalysisResultEvent = ServerEventEnvelope<
  "analysis.result",
  {
    meetingId: string;
    snapshot: LiveAnalysisSnapshot;
  }
>;

export type SessionStatusEvent = ServerEventEnvelope<
  "session.status",
  {
    meetingId: string;
    state:
      | "ready"
      | "listening"
      | "paused"
      | "processing"
      | "stopped"
      | "error";
    message: string;
  }
>;

export type ServerToClientEvent =
  | SessionAckEvent
  | TranscriptPartialEvent
  | TranscriptCommittedEvent
  | AnalysisResultEvent
  | SessionStatusEvent;

export function makeClientEvent<T extends ClientToServerEvent>(
  event: Omit<T, "protocolVersion">,
): T {
  return {
    protocolVersion: EVENT_PROTOCOL_VERSION,
    ...event,
  } as T;
}

export function makeServerEvent<T extends ServerToClientEvent>(
  event: Omit<T, "protocolVersion">,
): T {
  return {
    protocolVersion: EVENT_PROTOCOL_VERSION,
    ...event,
  } as T;
}
