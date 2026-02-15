import type {
  PrismaClient,
  UserIntegration as PrismaUserIntegration,
} from "@prisma/client";
import type {
  UserIntegration,
  UUID,
  ISODateString,
  IntegrationProvider,
  JsonValue,
  CreateUserIntegrationInput,
} from "@ainotes/core";

export interface UpdateIntegrationTokensInput {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: ISODateString | null;
}

export interface UserIntegrationsRepository {
  upsert(input: CreateUserIntegrationInput): Promise<UserIntegration>;
  findByUser(userId: UUID): Promise<UserIntegration[]>;
  findByUserAndProvider(
    userId: UUID,
    provider: IntegrationProvider,
  ): Promise<UserIntegration | null>;
  updateTokens(
    userId: UUID,
    provider: IntegrationProvider,
    input: UpdateIntegrationTokensInput,
  ): Promise<UserIntegration>;
  deleteByUserAndProvider(
    userId: UUID,
    provider: IntegrationProvider,
  ): Promise<void>;
}

function toDomainUserIntegration(row: PrismaUserIntegration): UserIntegration {
  return {
    id: row.id as UUID,
    userId: row.userId as UUID,
    provider: row.provider as IntegrationProvider,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt
      ? (row.expiresAt.toISOString() as ISODateString)
      : null,
    metadataJson: row.metadataJson as JsonValue,
    createdAt: row.createdAt.toISOString() as ISODateString,
    updatedAt: row.updatedAt.toISOString() as ISODateString,
  };
}

export function createUserIntegrationsRepository(
  prisma: PrismaClient,
): UserIntegrationsRepository {
  return {
    async upsert(input) {
      const row = await prisma.userIntegration.upsert({
        where: {
          userId_provider: {
            userId: input.userId,
            provider: input.provider,
          },
        },
        create: {
          userId: input.userId,
          provider: input.provider,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          metadataJson: input.metadataJson as object,
        },
        update: {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          metadataJson: input.metadataJson as object,
        },
      });

      return toDomainUserIntegration(row);
    },

    async findByUser(userId) {
      const rows = await prisma.userIntegration.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainUserIntegration);
    },

    async findByUserAndProvider(userId, provider) {
      const row = await prisma.userIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });
      return row ? toDomainUserIntegration(row) : null;
    },

    async updateTokens(userId, provider, input) {
      const row = await prisma.userIntegration.update({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
        data: {
          accessToken: input.accessToken,
          ...(input.refreshToken !== undefined && {
            refreshToken: input.refreshToken,
          }),
          ...(input.expiresAt !== undefined && {
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          }),
        },
      });

      return toDomainUserIntegration(row);
    },

    async deleteByUserAndProvider(userId, provider) {
      await prisma.userIntegration.deleteMany({
        where: {
          userId,
          provider,
        },
      });
    },
  };
}
