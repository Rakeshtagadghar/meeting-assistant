import type {
  PrismaClient,
  AISummary as PrismaAISummary,
} from "@prisma/client";
import type {
  AISummary,
  AISummaryKind,
  UUID,
  ISODateString,
  JsonValue,
} from "@ainotes/core";

export interface CreateAISummaryInput {
  noteId: UUID;
  meetingSessionId: UUID | null;
  kind: AISummaryKind;
  payload: JsonValue;
  modelInfo: JsonValue;
}

export interface AISummariesRepository {
  create(input: CreateAISummaryInput): Promise<AISummary>;
  findByNote(noteId: UUID): Promise<AISummary[]>;
  deleteByNoteAndKind(noteId: UUID, kind: AISummaryKind): Promise<void>;
}

function toDomainSummary(row: PrismaAISummary): AISummary {
  // AISummary is a discriminated union — cast through unknown
  return {
    id: row.id as UUID,
    noteId: row.noteId as UUID,
    meetingSessionId: row.meetingSessionId
      ? (row.meetingSessionId as UUID)
      : null,
    kind: row.kind as AISummaryKind,
    payload: row.payload as JsonValue,
    modelInfo: row.modelInfo as JsonValue,
    createdAt: row.createdAt.toISOString() as ISODateString,
  } as unknown as AISummary;
}

export function createAISummariesRepository(
  prisma: PrismaClient,
): AISummariesRepository {
  return {
    async create(input) {
      const row = await prisma.aISummary.create({
        data: {
          noteId: input.noteId,
          meetingSessionId: input.meetingSessionId,
          kind: input.kind,
          payload: input.payload as object,
          modelInfo: (input.modelInfo as object) ?? {},
        },
      });
      return toDomainSummary(row);
    },

    async findByNote(noteId) {
      const rows = await prisma.aISummary.findMany({
        where: { noteId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainSummary);
    },

    async deleteByNoteAndKind(noteId, kind) {
      await prisma.aISummary.deleteMany({
        where: { noteId, kind },
      });
    },
  };
}
