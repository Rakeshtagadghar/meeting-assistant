import type {
  PrismaClient,
  MeetingSession as PrismaMeetingSession,
} from "@prisma/client";
import type {
  MeetingSession,
  UUID,
  ISODateString,
  MeetingSessionSource,
  MeetingSessionStatus,
  MeetingPlatform,
} from "@ainotes/core";

export interface CreateMeetingSessionData {
  userId: UUID;
  noteId: UUID;
  source?: MeetingSessionSource;
  platform?: MeetingPlatform;
  title?: string;
  participants?: string[];
}

export interface MeetingSessionsRepository {
  create(data: CreateMeetingSessionData): Promise<MeetingSession>;
  findById(id: UUID): Promise<MeetingSession | null>;
  findByNoteId(noteId: UUID): Promise<MeetingSession[]>;
  findByUserId(userId: UUID): Promise<MeetingSession[]>;
  findActiveByUserId(userId: UUID): Promise<MeetingSession | null>;
  update(
    id: UUID,
    data: Partial<{
      status: MeetingSessionStatus;
      title: string;
      participants: string[];
      consentConfirmed: boolean;
      consentText: string | null;
      endedAt: Date;
      audioStored: boolean;
    }>,
  ): Promise<MeetingSession>;
  confirmConsent(
    id: UUID,
    consentText: string | null,
    title?: string,
    participants?: string[],
  ): Promise<MeetingSession>;
}

function toDomainMeetingSession(row: PrismaMeetingSession): MeetingSession {
  return {
    id: row.id as UUID,
    userId: row.userId as UUID,
    noteId: row.noteId as UUID,
    source: row.source as MeetingSessionSource,
    platform: row.platform as MeetingPlatform,
    title: row.title,
    participants: row.participants as unknown as readonly string[],
    startedAt: row.startedAt.toISOString() as ISODateString,
    endedAt: row.endedAt ? (row.endedAt.toISOString() as ISODateString) : null,
    consentConfirmed: row.consentConfirmed,
    consentText: row.consentText,
    audioStored: row.audioStored,
    status: row.status as MeetingSessionStatus,
  };
}

export function createMeetingSessionsRepository(
  prisma: PrismaClient,
): MeetingSessionsRepository {
  return {
    async create(data) {
      const row = await prisma.meetingSession.create({
        data: {
          userId: data.userId,
          noteId: data.noteId,
          source: data.source ?? "MANUAL",
          platform: data.platform ?? "MANUAL",
          title: data.title ?? null,
          participants: data.participants ?? [],
        },
      });
      return toDomainMeetingSession(row);
    },

    async findById(id) {
      const row = await prisma.meetingSession.findUnique({
        where: { id },
      });
      return row ? toDomainMeetingSession(row) : null;
    },

    async findByNoteId(noteId) {
      const rows = await prisma.meetingSession.findMany({
        where: { noteId },
        orderBy: { startedAt: "desc" },
      });
      return rows.map(toDomainMeetingSession);
    },

    async findByUserId(userId) {
      const rows = await prisma.meetingSession.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
      });
      return rows.map(toDomainMeetingSession);
    },

    async findActiveByUserId(userId) {
      const row = await prisma.meetingSession.findFirst({
        where: {
          userId,
          status: { in: ["IDLE", "RECORDING", "PAUSED"] },
        },
        orderBy: { startedAt: "desc" },
      });
      return row ? toDomainMeetingSession(row) : null;
    },

    async update(id, data) {
      const row = await prisma.meetingSession.update({
        where: { id },
        data,
      });
      return toDomainMeetingSession(row);
    },

    async confirmConsent(id, consentText, title, participants) {
      const updateData: Record<string, unknown> = {
        consentConfirmed: true,
        consentText: consentText ?? "User consented to recording.",
      };
      if (title !== undefined) updateData["title"] = title;
      if (participants !== undefined) updateData["participants"] = participants;

      const row = await prisma.meetingSession.update({
        where: { id },
        data: updateData,
      });
      return toDomainMeetingSession(row);
    },
  };
}
