import type {
  PrismaClient,
  NoteArtifact as PrismaArtifact,
} from "@prisma/client";
import type {
  NoteArtifact,
  UUID,
  ISODateString,
  ArtifactType,
  ArtifactStatus,
} from "@ainotes/core";

export interface CreateArtifactDbInput {
  noteId: UUID;
  jobId: UUID;
  type: ArtifactType;
}

export interface UpdateArtifactFields {
  status?: ArtifactStatus;
  storagePath?: string | null;
  hash?: string | null;
}

export interface ArtifactsRepository {
  create(input: CreateArtifactDbInput): Promise<NoteArtifact>;
  findByJob(jobId: UUID): Promise<NoteArtifact[]>;
  findByNoteAndType(
    noteId: UUID,
    type: ArtifactType,
  ): Promise<NoteArtifact | null>;
  findByNote(noteId: UUID): Promise<NoteArtifact[]>;
  update(artifactId: UUID, fields: UpdateArtifactFields): Promise<NoteArtifact>;
  deleteByNoteAndType(noteId: UUID, type: ArtifactType): Promise<void>;
}

function toDomainArtifact(row: PrismaArtifact): NoteArtifact {
  return {
    id: row.id as UUID,
    noteId: row.noteId as UUID,
    jobId: row.jobId as UUID,
    type: row.type as ArtifactType,
    status: row.status as ArtifactStatus,
    storagePath: row.storagePath,
    hash: row.hash,
    createdAt: row.createdAt.toISOString() as ISODateString,
    updatedAt: row.updatedAt.toISOString() as ISODateString,
  };
}

export function createArtifactsRepository(
  prisma: PrismaClient,
): ArtifactsRepository {
  return {
    async create(input) {
      const row = await prisma.noteArtifact.create({
        data: {
          noteId: input.noteId,
          jobId: input.jobId,
          type: input.type,
        },
      });
      return toDomainArtifact(row);
    },

    async findByJob(jobId) {
      const rows = await prisma.noteArtifact.findMany({
        where: { jobId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainArtifact);
    },

    async findByNoteAndType(noteId, type) {
      const row = await prisma.noteArtifact.findFirst({
        where: { noteId, type },
        orderBy: { createdAt: "desc" },
      });
      return row ? toDomainArtifact(row) : null;
    },

    async findByNote(noteId) {
      const rows = await prisma.noteArtifact.findMany({
        where: { noteId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainArtifact);
    },

    async update(artifactId, fields) {
      const data: Record<string, unknown> = {};
      if (fields.status !== undefined) data["status"] = fields.status;
      if (fields.storagePath !== undefined)
        data["storagePath"] = fields.storagePath;
      if (fields.hash !== undefined) data["hash"] = fields.hash;

      const row = await prisma.noteArtifact.update({
        where: { id: artifactId },
        data,
      });
      return toDomainArtifact(row);
    },

    async deleteByNoteAndType(noteId, type) {
      await prisma.noteArtifact.deleteMany({
        where: { noteId, type },
      });
    },
  };
}
