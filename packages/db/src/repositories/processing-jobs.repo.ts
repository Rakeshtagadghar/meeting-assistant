import type {
  PrismaClient,
  NoteProcessingJob as PrismaJob,
} from "@prisma/client";
import type {
  NoteProcessingJob,
  UUID,
  ISODateString,
  ProcessingJobKind,
  ProcessingJobStatus,
} from "@ainotes/core";

export interface CreateJobInput {
  noteId: UUID;
  userId: UUID;
  kind: ProcessingJobKind;
}

export interface UpdateJobFields {
  status?: ProcessingJobStatus;
  progressPct?: number;
  message?: string | null;
  startedAt?: Date;
  endedAt?: Date;
  error?: string | null;
}

export interface ProcessingJobsRepository {
  create(input: CreateJobInput): Promise<NoteProcessingJob>;
  findById(jobId: UUID, userId: UUID): Promise<NoteProcessingJob | null>;
  /** For background job processing where ownership was verified at job creation */
  findByIdInternal(jobId: UUID): Promise<NoteProcessingJob | null>;
  findByNote(noteId: UUID, userId: UUID): Promise<NoteProcessingJob[]>;
  update(jobId: UUID, fields: UpdateJobFields): Promise<NoteProcessingJob>;
}

function toDomainJob(row: PrismaJob): NoteProcessingJob {
  return {
    id: row.id as UUID,
    noteId: row.noteId as UUID,
    userId: row.userId as UUID,
    kind: row.kind as ProcessingJobKind,
    status: row.status as ProcessingJobStatus,
    progressPct: row.progressPct,
    message: row.message,
    startedAt: row.startedAt
      ? (row.startedAt.toISOString() as ISODateString)
      : null,
    endedAt: row.endedAt ? (row.endedAt.toISOString() as ISODateString) : null,
    error: row.error,
    createdAt: row.createdAt.toISOString() as ISODateString,
    updatedAt: row.updatedAt.toISOString() as ISODateString,
  };
}

export function createProcessingJobsRepository(
  prisma: PrismaClient,
): ProcessingJobsRepository {
  return {
    async create(input) {
      const row = await prisma.noteProcessingJob.create({
        data: {
          noteId: input.noteId,
          userId: input.userId,
          kind: input.kind,
        },
      });
      return toDomainJob(row);
    },

    async findById(jobId, userId) {
      const row = await prisma.noteProcessingJob.findFirst({
        where: { id: jobId, userId },
      });
      return row ? toDomainJob(row) : null;
    },

    async findByIdInternal(jobId) {
      const row = await prisma.noteProcessingJob.findUnique({
        where: { id: jobId },
      });
      return row ? toDomainJob(row) : null;
    },

    async findByNote(noteId, userId) {
      const rows = await prisma.noteProcessingJob.findMany({
        where: { noteId, userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainJob);
    },

    async update(jobId, fields) {
      const data: Record<string, unknown> = {};
      if (fields.status !== undefined) data["status"] = fields.status;
      if (fields.progressPct !== undefined)
        data["progressPct"] = fields.progressPct;
      if (fields.message !== undefined) data["message"] = fields.message;
      if (fields.startedAt !== undefined) data["startedAt"] = fields.startedAt;
      if (fields.endedAt !== undefined) data["endedAt"] = fields.endedAt;
      if (fields.error !== undefined) data["error"] = fields.error;

      const row = await prisma.noteProcessingJob.update({
        where: { id: jobId },
        data,
      });
      return toDomainJob(row);
    },
  };
}
