import type {
  PrismaClient,
  ShareLink as PrismaShareLink,
} from "@prisma/client";
import type {
  ShareLink,
  UUID,
  ISODateString,
  CreateShareLinkInput,
  ShareVisibility,
} from "@ainotes/core";

export interface ShareLinksRepository {
  create(input: CreateShareLinkInput, token: string): Promise<ShareLink>;
  findByToken(token: string): Promise<ShareLink | null>;
  findByNote(noteId: UUID, userId: UUID): Promise<ShareLink[]>;
  revoke(id: UUID, userId: UUID): Promise<void>;
}

function toDomainShareLink(row: PrismaShareLink): ShareLink {
  return {
    id: row.id as UUID,
    noteId: row.noteId as UUID,
    createdByUserId: row.createdByUserId as UUID,
    visibility: row.visibility as ShareVisibility,
    allowedEmails: row.allowedEmails as unknown as readonly string[],
    token: row.token,
    expiresAt: row.expiresAt
      ? (row.expiresAt.toISOString() as ISODateString)
      : null,
    createdAt: row.createdAt.toISOString() as ISODateString,
  };
}

export function createShareLinksRepository(
  prisma: PrismaClient,
): ShareLinksRepository {
  return {
    async create(input, token) {
      const row = await prisma.shareLink.create({
        data: {
          noteId: input.noteId,
          createdByUserId: input.createdByUserId,
          visibility: input.visibility,
          allowedEmails: [...input.allowedEmails],
          token,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      return toDomainShareLink(row);
    },

    async findByToken(token) {
      const row = await prisma.shareLink.findUnique({ where: { token } });
      return row ? toDomainShareLink(row) : null;
    },

    async findByNote(noteId, userId) {
      const rows = await prisma.shareLink.findMany({
        where: { noteId, createdByUserId: userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainShareLink);
    },

    async revoke(id, userId) {
      const existing = await prisma.shareLink.findFirst({
        where: { id, createdByUserId: userId },
      });
      if (!existing) {
        throw new Error(`ShareLink ${id} not found for user ${userId}`);
      }
      await prisma.shareLink.delete({ where: { id } });
    },
  };
}
