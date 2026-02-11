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
