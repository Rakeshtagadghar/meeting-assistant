import type {
  PrismaClient,
  TranscriptChunk as PrismaTranscriptChunk,
} from "@prisma/client";
import type { TranscriptChunk, UUID, ISODateString } from "@ainotes/core";

export interface CreateTranscriptChunkData {
  meetingSessionId: UUID;
  sequence: number;
  tStartMs: number;
  tEndMs: number;
  speaker: string | null;
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
  text: string;
  confidence: number | null;
}

export interface TranscriptChunksRepository {
  create(data: CreateTranscriptChunkData): Promise<TranscriptChunk>;
  createMany(chunks: CreateTranscriptChunkData[]): Promise<number>;
  findBySessionId(
    sessionId: UUID,
    opts?: { limit?: number; afterSequence?: number },
  ): Promise<TranscriptChunk[]>;
  findBySessionIdInRange(
    sessionId: UUID,
    startMs: number,
    endMs: number,
  ): Promise<TranscriptChunk[]>;
  getMaxSequence(sessionId: UUID): Promise<number>;
  deleteBySessionId(sessionId: UUID): Promise<number>;
}

function toDomainTranscriptChunk(row: PrismaTranscriptChunk): TranscriptChunk {
  return {
    id: row.id as UUID,
    meetingSessionId: row.meetingSessionId as UUID,
    sequence: row.sequence,
    tStartMs: row.tStartMs,
    tEndMs: row.tEndMs,
    speaker: row.speaker,
    prosodyEnergy: row.prosodyEnergy,
    prosodyPauseRatio: row.prosodyPauseRatio,
    prosodyVoicedMs: row.prosodyVoicedMs,
    prosodySnrDb: row.prosodySnrDb,
    prosodyQualityPass: row.prosodyQualityPass,
    prosodyToneWeightsEnabled: row.prosodyToneWeightsEnabled,
    prosodyConfidencePenalty: row.prosodyConfidencePenalty,
    prosodyClientEnergy: row.prosodyClientEnergy,
    prosodyClientStress: row.prosodyClientStress,
    prosodyClientCertainty: row.prosodyClientCertainty,
    text: row.text,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString() as ISODateString,
  };
}

export function createTranscriptChunksRepository(
  prisma: PrismaClient,
): TranscriptChunksRepository {
  return {
    async create(data) {
      const row = await prisma.transcriptChunk.create({
        data: {
          meetingSessionId: data.meetingSessionId,
          sequence: data.sequence,
          tStartMs: data.tStartMs,
          tEndMs: data.tEndMs,
          speaker: data.speaker,
          prosodyEnergy: data.prosodyEnergy,
          prosodyPauseRatio: data.prosodyPauseRatio,
          prosodyVoicedMs: data.prosodyVoicedMs,
          prosodySnrDb: data.prosodySnrDb,
          prosodyQualityPass: data.prosodyQualityPass,
          prosodyToneWeightsEnabled: data.prosodyToneWeightsEnabled,
          prosodyConfidencePenalty: data.prosodyConfidencePenalty,
          prosodyClientEnergy: data.prosodyClientEnergy,
          prosodyClientStress: data.prosodyClientStress,
          prosodyClientCertainty: data.prosodyClientCertainty,
          text: data.text,
          confidence: data.confidence,
        },
      });
      return toDomainTranscriptChunk(row);
    },

    async createMany(chunks) {
      const result = await prisma.transcriptChunk.createMany({
        data: chunks.map((c) => ({
          meetingSessionId: c.meetingSessionId,
          sequence: c.sequence,
          tStartMs: c.tStartMs,
          tEndMs: c.tEndMs,
          speaker: c.speaker,
          prosodyEnergy: c.prosodyEnergy,
          prosodyPauseRatio: c.prosodyPauseRatio,
          prosodyVoicedMs: c.prosodyVoicedMs,
          prosodySnrDb: c.prosodySnrDb,
          prosodyQualityPass: c.prosodyQualityPass,
          prosodyToneWeightsEnabled: c.prosodyToneWeightsEnabled,
          prosodyConfidencePenalty: c.prosodyConfidencePenalty,
          prosodyClientEnergy: c.prosodyClientEnergy,
          prosodyClientStress: c.prosodyClientStress,
          prosodyClientCertainty: c.prosodyClientCertainty,
          text: c.text,
          confidence: c.confidence,
        })),
      });
      return result.count;
    },

    async findBySessionId(sessionId, opts) {
      const where: Record<string, unknown> = {
        meetingSessionId: sessionId,
      };
      if (opts?.afterSequence !== undefined) {
        where["sequence"] = { gt: opts.afterSequence };
      }

      const rows = await prisma.transcriptChunk.findMany({
        where,
        orderBy: { sequence: "asc" },
        take: opts?.limit,
      });
      return rows.map(toDomainTranscriptChunk);
    },

    async findBySessionIdInRange(sessionId, startMs, endMs) {
      const rows = await prisma.transcriptChunk.findMany({
        where: {
          meetingSessionId: sessionId,
          tStartMs: { lt: endMs },
          tEndMs: { gt: startMs },
        },
        orderBy: { sequence: "asc" },
      });
      return rows.map(toDomainTranscriptChunk);
    },

    async getMaxSequence(sessionId) {
      const result = await prisma.transcriptChunk.aggregate({
        where: { meetingSessionId: sessionId },
        _max: { sequence: true },
      });
      return result._max.sequence ?? -1;
    },

    async deleteBySessionId(sessionId) {
      const result = await prisma.transcriptChunk.deleteMany({
        where: { meetingSessionId: sessionId },
      });
      return result.count;
    },
  };
}
