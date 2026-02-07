import type { PrismaClient, Note as PrismaNote } from "@prisma/client";
import type {
  Note,
  UUID,
  ISODateString,
  CreateNoteInput,
  UpdateNoteInput,
  JsonValue,
  NoteType,
} from "@ainotes/core";

export interface NotesRepository {
  create(userId: UUID, input: CreateNoteInput): Promise<Note>;
  findById(id: UUID, userId: UUID): Promise<Note | null>;
  /** For background job processing where ownership was verified at job creation */
  findByIdInternal(id: UUID): Promise<Note | null>;
  findByUser(
    userId: UUID,
    opts?: {
      q?: string;
      tag?: string;
      pinned?: boolean;
    },
  ): Promise<Note[]>;
  update(id: UUID, userId: UUID, input: UpdateNoteInput): Promise<Note>;
  softDelete(id: UUID, userId: UUID): Promise<Note>;
  hardDelete(id: UUID, userId: UUID): Promise<void>;
}

function toDomainNote(row: PrismaNote): Note {
  return {
    id: row.id as UUID,
    userId: row.userId as UUID,
    title: row.title,
    contentRich: row.contentRich as JsonValue,
    contentPlain: row.contentPlain,
    type: row.type as NoteType,
    tags: row.tags as unknown as readonly string[],
    pinned: row.pinned,
    folderId: row.folderId ? (row.folderId as UUID) : null,
    createdAt: row.createdAt.toISOString() as ISODateString,
    updatedAt: row.updatedAt.toISOString() as ISODateString,
    deletedAt: row.deletedAt
      ? (row.deletedAt.toISOString() as ISODateString)
      : null,
  };
}

export function createNotesRepository(prisma: PrismaClient): NotesRepository {
  return {
    async create(userId, input) {
      const row = await prisma.note.create({
        data: {
          userId,
          title: input.title,
          contentRich: input.contentRich as object,
          contentPlain: input.contentPlain,
          type: input.type,
          tags: [...input.tags],
          folderId: input.folderId ?? null,
        },
      });
      return toDomainNote(row);
    },

    async findById(id, userId) {
      const row = await prisma.note.findFirst({
        where: { id, userId, deletedAt: null },
      });
      return row ? toDomainNote(row) : null;
    },

    async findByIdInternal(id) {
      const row = await prisma.note.findFirst({
        where: { id, deletedAt: null },
      });
      return row ? toDomainNote(row) : null;
    },

    async findByUser(userId, opts) {
      const where: Record<string, unknown> = {
        userId,
        deletedAt: null,
      };

      if (opts?.tag) {
        where["tags"] = { has: opts.tag };
      }

      if (opts?.pinned !== undefined) {
        where["pinned"] = opts.pinned;
      }

      if (opts?.q) {
        where["title"] = { contains: opts.q, mode: "insensitive" };
      }

      const rows = await prisma.note.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      });

      return rows.map(toDomainNote);
    },

    async update(id, userId, input) {
      const existing = await prisma.note.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!existing) {
        throw new Error(`Note ${id} not found for user ${userId}`);
      }

      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data["title"] = input.title;
      if (input.contentRich !== undefined)
        data["contentRich"] = input.contentRich as object;
      if (input.contentPlain !== undefined)
        data["contentPlain"] = input.contentPlain;
      if (input.tags !== undefined) data["tags"] = [...input.tags];
      if (input.pinned !== undefined) data["pinned"] = input.pinned;
      if (input.folderId !== undefined)
        data["folderId"] = input.folderId ?? null;

      const row = await prisma.note.update({
        where: { id },
        data,
      });
      return toDomainNote(row);
    },

    async softDelete(id, userId) {
      const existing = await prisma.note.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new Error(`Note ${id} not found for user ${userId}`);
      }

      const row = await prisma.note.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return toDomainNote(row);
    },

    async hardDelete(id, userId) {
      const existing = await prisma.note.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new Error(`Note ${id} not found for user ${userId}`);
      }

      await prisma.note.delete({ where: { id } });
    },
  };
}
