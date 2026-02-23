import type {
  PrismaClient,
  SummaryArtifact as PrismaSummaryArtifact,
  SummarySection as PrismaSummarySection,
} from "@prisma/client";
import type {
  UUID,
  ISODateString,
  JsonValue,
  Citation,
  SummarySectionData,
  SummaryArtifactData,
  SummaryArtifactStatus,
  CreateSummaryArtifactInput,
} from "@ainotes/core";

export interface SummaryArtifactsRepository {
  create(input: CreateSummaryArtifactInput): Promise<SummaryArtifactData>;
  findById(id: UUID): Promise<SummaryArtifactData | null>;
  findByNote(noteId: UUID): Promise<SummaryArtifactData[]>;
  findLatestByNote(noteId: UUID): Promise<SummaryArtifactData | null>;
  updateStatus(id: UUID, status: SummaryArtifactStatus): Promise<void>;
  updateSection(
    sectionId: UUID,
    updates: Partial<{
      contentMarkdown: string;
      citations: readonly Citation[];
      locked: boolean;
      userEdited: boolean;
      warnings: readonly string[];
    }>,
  ): Promise<SummarySectionData>;
  incrementSectionVersion(
    sectionId: UUID,
    newContent: string,
    newCitations: readonly Citation[],
    newWarnings: readonly string[],
  ): Promise<SummarySectionData>;
}

function toDomainSection(row: PrismaSummarySection): SummarySectionData {
  return {
    id: row.id as UUID,
    summaryArtifactId: row.summaryArtifactId as UUID,
    key: row.key,
    title: row.title,
    contentMarkdown: row.contentMarkdown,
    citations: row.citations as unknown as readonly Citation[],
    sectionVersion: row.sectionVersion,
    locked: row.locked,
    userEdited: row.userEdited,
    regenCount: row.regenCount,
    lastRegeneratedAt: row.lastRegeneratedAt
      ? (row.lastRegeneratedAt.toISOString() as ISODateString)
      : null,
    order: row.order,
    warnings: row.warnings as unknown as readonly string[],
    createdAt: row.createdAt.toISOString() as ISODateString,
    updatedAt: row.updatedAt.toISOString() as ISODateString,
  };
}

function toDomainArtifact(
  row: PrismaSummaryArtifact & { sections: PrismaSummarySection[] },
): SummaryArtifactData {
  return {
    id: row.id as UUID,
    noteId: row.noteId as UUID,
    meetingSessionId: row.meetingSessionId
      ? (row.meetingSessionId as UUID)
      : null,
    templateId: row.templateId ? (row.templateId as UUID) : null,
    version: row.version,
    status: row.status as SummaryArtifactStatus,
    citationsIndex: row.citationsIndex as JsonValue,
    modelInfo: row.modelInfo as JsonValue,
    scope: row.scope,
    sections: row.sections
      .sort((a, b) => a.order - b.order)
      .map(toDomainSection),
    createdAt: row.createdAt.toISOString() as ISODateString,
    updatedAt: row.updatedAt.toISOString() as ISODateString,
  };
}

export function createSummaryArtifactsRepository(
  prisma: PrismaClient,
): SummaryArtifactsRepository {
  return {
    async create(input) {
      // Determine next version for this note
      const latest = await prisma.summaryArtifact.findFirst({
        where: { noteId: input.noteId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      const row = await prisma.summaryArtifact.create({
        data: {
          noteId: input.noteId,
          meetingSessionId: input.meetingSessionId ?? null,
          templateId: input.templateId ?? null,
          version: nextVersion,
          scope: input.scope ?? "all_meeting_sources",
          modelInfo: (input.modelInfo as object) ?? {},
          sections: {
            create: input.sections.map((s) => ({
              key: s.key,
              title: s.title,
              contentMarkdown: s.contentMarkdown,
              citations: s.citations as unknown as object[],
              order: s.order,
              warnings: (s.warnings as unknown as object[]) ?? [],
            })),
          },
        },
        include: { sections: true },
      });
      return toDomainArtifact(row);
    },

    async findById(id) {
      const row = await prisma.summaryArtifact.findUnique({
        where: { id },
        include: { sections: true },
      });
      return row ? toDomainArtifact(row) : null;
    },

    async findByNote(noteId) {
      const rows = await prisma.summaryArtifact.findMany({
        where: { noteId },
        orderBy: { version: "desc" },
        include: { sections: true },
      });
      return rows.map(toDomainArtifact);
    },

    async findLatestByNote(noteId) {
      const row = await prisma.summaryArtifact.findFirst({
        where: { noteId },
        orderBy: { version: "desc" },
        include: { sections: true },
      });
      return row ? toDomainArtifact(row) : null;
    },

    async updateStatus(id, status) {
      await prisma.summaryArtifact.update({
        where: { id },
        data: { status },
      });
    },

    async updateSection(sectionId, updates) {
      const data: Record<string, unknown> = {};
      if (updates.contentMarkdown !== undefined)
        data.contentMarkdown = updates.contentMarkdown;
      if (updates.citations !== undefined)
        data.citations = updates.citations as unknown as object[];
      if (updates.locked !== undefined) data.locked = updates.locked;
      if (updates.userEdited !== undefined)
        data.userEdited = updates.userEdited;
      if (updates.warnings !== undefined)
        data.warnings = updates.warnings as unknown as object[];

      const row = await prisma.summarySection.update({
        where: { id: sectionId },
        data,
      });
      return toDomainSection(row);
    },

    async incrementSectionVersion(
      sectionId,
      newContent,
      newCitations,
      newWarnings,
    ) {
      const row = await prisma.summarySection.update({
        where: { id: sectionId },
        data: {
          contentMarkdown: newContent,
          citations: newCitations as unknown as object[],
          warnings: newWarnings as unknown as object[],
          sectionVersion: { increment: 1 },
          regenCount: { increment: 1 },
          lastRegeneratedAt: new Date(),
        },
      });
      return toDomainSection(row);
    },
  };
}
