import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AI_MODELS } from "@ainotes/config/ai-models";
import type { UUID } from "@ainotes/core";
import type {
  AudioPacketProsody,
  ServerToClientEvent,
} from "@ainotes/event-protocol";
import { makeServerEvent } from "@ainotes/event-protocol";
import { parseClientEventEnvelope } from "@ainotes/validation-schemas";
import type { LiveAnalysisChunkInput } from "@/features/capture/live-analysis/types";
import { buildHeuristicLiveAnalysis } from "@/lib/live-analysis/engine";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createMeetingSessionsRepository,
  createTranscriptChunksRepository,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionsRepo = createMeetingSessionsRepository(prisma);
const chunksRepo = createTranscriptChunksRepository(prisma);

interface PendingAudioPacket {
  seq: number;
  tStartMs: number;
  tEndMs: number;
  audioBase64: string;
  prosody?: AudioPacketProsody;
}

interface MeetingRealtimeState {
  lastAckedSeq: number;
  analysisEnabled: boolean;
  language: string;
  pendingPackets: PendingAudioPacket[];
}

const meetingStateStore = new Map<string, MeetingRealtimeState>();
const MAX_PENDING_PACKETS = 120;

interface ElevenLabsErrorResponse {
  detail?: {
    code?: string;
    status?: string;
  };
}

interface ElevenLabsTranscribeResponse {
  text?: string;
  transcript?: string;
}

function getMeetingState(meetingId: string): MeetingRealtimeState {
  const existing = meetingStateStore.get(meetingId);
  if (existing) return existing;
  const created: MeetingRealtimeState = {
    lastAckedSeq: 0,
    analysisEnabled: false,
    language: "auto",
    pendingPackets: [],
  };
  meetingStateStore.set(meetingId, created);
  return created;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pushServerEvent(
  events: ServerToClientEvent[],
  event: Omit<ServerToClientEvent, "protocolVersion">,
): void {
  events.push(makeServerEvent(event));
}

function normalizeLanguage(input: string): string | undefined {
  if (!input || input === "auto") return undefined;
  return input;
}

function normalizeModelForSpeechToText(modelId: string): string {
  const normalized = modelId.trim();
  if (
    normalized === "scribe_v2_realtime" ||
    normalized === "scribe-v2-realtime"
  ) {
    return "scribe-v2";
  }
  if (normalized === "scribe_v2") {
    return "scribe-v2";
  }
  if (normalized === "scribe_v1_experimental") {
    return "scribe-v1-experimental";
  }
  if (normalized === "scribe_v1") {
    return "scribe-v1";
  }
  return normalized;
}

function buildModelCandidates(configuredModelId: string): string[] {
  const candidates = [
    normalizeModelForSpeechToText(configuredModelId),
    "scribe-v2",
    "scribe_v2",
    "scribe-v1-experimental",
    "scribe_v1_experimental",
    "scribe-v1",
    "scribe_v1",
  ];
  return [...new Set(candidates)];
}

function isUnsupportedModelError(status: number, payloadText: string): boolean {
  if (status !== 400) return false;
  try {
    const payload = JSON.parse(payloadText) as ElevenLabsErrorResponse;
    const code = payload.detail?.code ?? "";
    const detailStatus = payload.detail?.status ?? "";
    return code === "unsupported_model" || detailStatus === "invalid_model_id";
  } catch {
    return false;
  }
}

function decodeBase64(input: string): Uint8Array {
  return Buffer.from(input, "base64");
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i) & 0xff);
  }
}

function pcm16leToWav(pcmBytes: Uint8Array): Uint8Array {
  const sampleRateHz = 16_000;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRateHz * blockAlign;

  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  const view = new DataView(wavBytes.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcmBytes.length, true);

  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

async function transcribeWithElevenLabs(args: {
  pcmBase64: string;
  language: string;
}): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const pcmBytes = decodeBase64(args.pcmBase64);
  if (pcmBytes.length === 0) return null;
  const wavBytes = pcm16leToWav(pcmBytes);
  const wavArrayBuffer = wavBytes.buffer.slice(
    wavBytes.byteOffset,
    wavBytes.byteOffset + wavBytes.byteLength,
  ) as ArrayBuffer;
  const wavFile = new File([wavArrayBuffer], "mobile-utterance.wav", {
    type: "audio/wav",
  });

  const modelCandidates = buildModelCandidates(
    AI_MODELS.elevenlabs.realtimeStt,
  );
  const normalizedLanguage = normalizeLanguage(args.language);

  for (const modelId of modelCandidates) {
    const formData = new FormData();
    formData.set("model_id", modelId);
    formData.set("file", wavFile);
    if (normalizedLanguage) {
      formData.set("language_code", normalizedLanguage);
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: formData,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const payloadText = await response.text();
      if (isUnsupportedModelError(response.status, payloadText)) {
        continue;
      }
      return null;
    }

    const payload = (await response.json()) as ElevenLabsTranscribeResponse;
    const text = (payload.text ?? payload.transcript ?? "").trim();
    return text || null;
  }

  return null;
}

function mapProsody(prosody?: AudioPacketProsody): {
  prosodyEnergy: number | null;
  prosodyPauseRatio: number | null;
  prosodyVoicedMs: number | null;
  prosodySnrDb: number | null;
  prosodyQualityPass: boolean | null;
  prosodyToneWeightsEnabled: boolean | null;
  prosodyConfidencePenalty: number | null;
  prosodyClientEnergy: number | null;
  prosodyClientStress: number | null;
  prosodyClientCertainty: number | null;
} {
  if (!prosody) {
    return {
      prosodyEnergy: null,
      prosodyPauseRatio: null,
      prosodyVoicedMs: null,
      prosodySnrDb: null,
      prosodyQualityPass: null,
      prosodyToneWeightsEnabled: null,
      prosodyConfidencePenalty: null,
      prosodyClientEnergy: null,
      prosodyClientStress: null,
      prosodyClientCertainty: null,
    };
  }

  return {
    prosodyEnergy: prosody.rmsEnergy,
    prosodyPauseRatio: prosody.pauseRatio,
    prosodyVoicedMs: prosody.voicedMs,
    prosodySnrDb: prosody.snrDb,
    prosodyQualityPass: prosody.qualityPass,
    prosodyToneWeightsEnabled: prosody.toneWeightsEnabled,
    prosodyConfidencePenalty: prosody.confidencePenalty,
    prosodyClientEnergy: prosody.clientEnergy,
    prosodyClientStress: prosody.clientStress,
    prosodyClientCertainty: prosody.clientCertainty,
  };
}

function buildAnalysisChunks(
  chunks: Awaited<ReturnType<typeof chunksRepo.findBySessionId>>,
  contextWindowSec: number,
): LiveAnalysisChunkInput[] {
  if (chunks.length === 0) return [];
  const newestTs = chunks[chunks.length - 1]?.tEndMs ?? 0;
  const windowStart = Math.max(0, newestTs - contextWindowSec * 1000);
  return chunks
    .filter((chunk) => chunk.tEndMs >= windowStart)
    .map((chunk) => ({
      id: chunk.id,
      sequence: chunk.sequence,
      tStartMs: chunk.tStartMs,
      tEndMs: chunk.tEndMs,
      speaker: chunk.speaker,
      speakerRole: "MIXED",
      audioSource: "microphone",
      prosodyEnergy: chunk.prosodyEnergy,
      prosodyPauseRatio: chunk.prosodyPauseRatio,
      prosodyVoicedMs: chunk.prosodyVoicedMs,
      prosodySnrDb: chunk.prosodySnrDb,
      prosodyQualityPass: chunk.prosodyQualityPass,
      prosodyToneWeightsEnabled: chunk.prosodyToneWeightsEnabled,
      prosodyConfidencePenalty: chunk.prosodyConfidencePenalty,
      prosodyClientEnergy: chunk.prosodyClientEnergy,
      prosodyClientStress: chunk.prosodyClientStress,
      prosodyClientCertainty: chunk.prosodyClientCertainty,
      text: chunk.text,
      confidence: chunk.confidence,
    }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const raw = (await request.json()) as unknown;
    const event = parseClientEventEnvelope(raw);
    if (!event) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid event envelope");
    }

    const meetingId = event.payload.meetingId;
    const session = await sessionsRepo.findById(meetingId as UUID);
    if (!session) return apiError(ApiErrorCode.NOT_FOUND);
    if (session.userId !== userId) return apiError(ApiErrorCode.FORBIDDEN);

    const state = getMeetingState(meetingId);
    const events: ServerToClientEvent[] = [];

    switch (event.type) {
      case "session.start": {
        state.language = event.payload.language || "auto";
        if (!session.consentConfirmed) {
          pushServerEvent(events, {
            type: "session.status",
            payload: {
              meetingId,
              state: "error",
              message: "Consent is required before starting the session.",
            },
          });
          break;
        }
        if (session.status !== "RECORDING") {
          await sessionsRepo.update(session.id, {
            status: "RECORDING",
          });
        }
        const maxSequence = await chunksRepo.getMaxSequence(session.id);
        state.lastAckedSeq = Math.max(
          state.lastAckedSeq,
          Math.max(0, maxSequence),
        );
        pushServerEvent(events, {
          type: "session.status",
          payload: {
            meetingId,
            state: "listening",
            message: "Session connected",
          },
        });
        pushServerEvent(events, {
          type: "session.ack",
          payload: {
            meetingId,
            lastAckedSeq: state.lastAckedSeq,
          },
        });
        break;
      }

      case "session.resume": {
        state.lastAckedSeq = Math.max(
          state.lastAckedSeq,
          event.payload.lastAckedSeq,
        );
        pushServerEvent(events, {
          type: "session.ack",
          payload: {
            meetingId,
            lastAckedSeq: state.lastAckedSeq,
          },
        });
        break;
      }

      case "analysis.toggle": {
        state.analysisEnabled = event.payload.enabled;
        break;
      }

      case "audio.packet": {
        const incoming = event.payload;
        if (incoming.seq <= state.lastAckedSeq) {
          pushServerEvent(events, {
            type: "session.ack",
            payload: {
              meetingId,
              lastAckedSeq: state.lastAckedSeq,
            },
          });
          break;
        }

        state.pendingPackets.push({
          seq: incoming.seq,
          tStartMs: incoming.tStartMs,
          tEndMs: incoming.tEndMs,
          audioBase64: incoming.audioBase64,
          prosody: incoming.prosody,
        });

        if (state.pendingPackets.length > MAX_PENDING_PACKETS) {
          state.pendingPackets.shift();
        }

        if (incoming.isFinal) {
          const utterancePackets = [...state.pendingPackets];
          state.pendingPackets = [];

          const mergedPcmBase64 = Buffer.from(
            concatBytes(
              utterancePackets.map((packet) =>
                decodeBase64(packet.audioBase64),
              ),
            ),
          ).toString("base64");
          const transcribed = await transcribeWithElevenLabs({
            pcmBase64: mergedPcmBase64,
            language: state.language,
          });

          const lastProsody =
            [...utterancePackets].reverse().find((packet) => packet.prosody)
              ?.prosody ?? null;
          const confidencePenalty =
            lastProsody?.confidencePenalty ?? (transcribed ? 0.2 : 0.6);
          const confidence = Number(
            clamp(1 - confidencePenalty, 0.1, 0.98).toFixed(2),
          );

          const persisted = await chunksRepo.create({
            meetingSessionId: session.id,
            sequence: incoming.seq,
            tStartMs: utterancePackets[0]?.tStartMs ?? incoming.tStartMs,
            tEndMs:
              utterancePackets[utterancePackets.length - 1]?.tEndMs ??
              incoming.tEndMs,
            speaker: null,
            ...mapProsody(lastProsody ?? undefined),
            text: transcribed ?? "[inaudible]",
            confidence,
          });

          pushServerEvent(events, {
            type: "transcript.committed",
            payload: {
              meetingId,
              seq: persisted.sequence,
              tStartMs: persisted.tStartMs,
              tEndMs: persisted.tEndMs,
              speaker: persisted.speaker,
              speakerRole: "MIXED",
              text: persisted.text,
              confidence: persisted.confidence,
            },
          });
        }

        state.lastAckedSeq = Math.max(state.lastAckedSeq, incoming.seq);
        pushServerEvent(events, {
          type: "session.ack",
          payload: {
            meetingId,
            lastAckedSeq: state.lastAckedSeq,
          },
        });
        break;
      }

      case "analysis.tick": {
        if (!state.analysisEnabled) break;

        const dbChunks = await chunksRepo.findBySessionId(session.id, {
          limit: 220,
        });
        const analysisChunks = buildAnalysisChunks(
          dbChunks,
          Math.max(event.payload.contextWindowSec, 15),
        );
        if (analysisChunks.length === 0) break;

        const analysis = buildHeuristicLiveAnalysis({
          meetingId,
          chunks: analysisChunks,
          useHeuristics: true,
          sensitivity: 50,
          coachingAggressiveness: 40,
        });

        pushServerEvent(events, {
          type: "analysis.result",
          payload: {
            meetingId,
            snapshot: {
              meetingId,
              generatedAtMs: Date.now(),
              callHealth: analysis.metrics.callHealth,
              callHealthConfidence: analysis.metrics.callHealthConfidence,
              clientValence: analysis.metrics.clientValence,
              clientEngagement: analysis.metrics.clientEngagement,
              riskFlags: [...analysis.metrics.riskFlags],
            },
          },
        });
        break;
      }

      case "session.stop": {
        state.pendingPackets = [];
        state.analysisEnabled = false;
        if (session.status !== "STOPPED") {
          await sessionsRepo.update(session.id, {
            status: "STOPPED",
            endedAt: new Date(),
          });
        }
        meetingStateStore.delete(meetingId);
        pushServerEvent(events, {
          type: "session.status",
          payload: {
            meetingId,
            state: "stopped",
            message: event.payload.reason || "Session stopped",
          },
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ events });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("POST /api/mobile/realtime error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
