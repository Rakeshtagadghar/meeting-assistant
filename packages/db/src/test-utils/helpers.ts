import { PrismaClient } from "@prisma/client";
import type { UUID } from "@ainotes/core";

let _client: PrismaClient | null = null;

export function getTestClient(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env["DATABASE_URL"] ??
            "postgresql://ainotes_test:ainotes_test@localhost:5433/ainotes_test?schema=public",
        },
      },
    });
  }
  return _client;
}

export async function disconnectTestClient(): Promise<void> {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.noteArtifact.deleteMany(),
    prisma.noteProcessingJob.deleteMany(),
    prisma.transcriptChunk.deleteMany(),
    prisma.aISummary.deleteMany(),
    prisma.shareLink.deleteMany(),
    prisma.meetingSession.deleteMany(),
    prisma.note.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createTestUser(
  prisma: PrismaClient,
  overrides?: { id?: string; email?: string; displayName?: string },
): Promise<{ id: UUID; email: string }> {
  const user = await prisma.user.create({
    data: {
      id: overrides?.id ?? crypto.randomUUID(),
      email: overrides?.email ?? `test-${crypto.randomUUID()}@example.com`,
      displayName: overrides?.displayName ?? "Test User",
    },
  });
  return { id: user.id as UUID, email: user.email };
}
