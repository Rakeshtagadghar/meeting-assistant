import type { IntegrationProvider, UUID, ISODateString } from "@ainotes/core";
import {
  prisma,
  createNotesRepository,
  createAISummariesRepository,
  createUserIntegrationsRepository,
} from "@/lib/db";
import { decryptSecret, encryptSecret } from "./crypto";
import { createNotionWorkspacePage, refreshNotionToken } from "./notion";
import { buildNotionExportPage } from "./notion-export";

export interface IntegrationExportResult {
  status: "success" | "error";
  externalUrl: string | null;
  error?: string;
}

export interface IntegrationConnector {
  readonly provider: IntegrationProvider;
  exportSummary(noteId: UUID, userId: UUID): Promise<IntegrationExportResult>;
}

class NotionConnector implements IntegrationConnector {
  readonly provider = "NOTION" as const;

  async exportSummary(
    noteId: UUID,
    userId: UUID,
  ): Promise<IntegrationExportResult> {
    try {
      const integrationsRepo = createUserIntegrationsRepository(prisma);
      const notesRepo = createNotesRepository(prisma);
      const summariesRepo = createAISummariesRepository(prisma);

      const integration = await integrationsRepo.findByUserAndProvider(
        userId,
        this.provider,
      );

      if (!integration) {
        return {
          status: "error",
          externalUrl: null,
          error: "Notion is not connected. Connect your workspace first.",
        };
      }

      let accessToken = decryptSecret(integration.accessToken);
      let refreshToken = integration.refreshToken
        ? decryptSecret(integration.refreshToken)
        : null;

      if (
        integration.expiresAt &&
        new Date(integration.expiresAt).getTime() <= Date.now() + 30_000
      ) {
        if (!refreshToken) {
          return {
            status: "error",
            externalUrl: null,
            error:
              "Notion token has expired and no refresh token is available. Reconnect Notion.",
          };
        }

        const refreshed = await refreshNotionToken(refreshToken);
        accessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token ?? refreshToken;

        const expiresAt = refreshed.expires_in
          ? (new Date(
              Date.now() + refreshed.expires_in * 1000,
            ).toISOString() as ISODateString)
          : null;

        await integrationsRepo.updateTokens(userId, this.provider, {
          accessToken: encryptSecret(accessToken),
          refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
          expiresAt,
        });
      }

      const note = await notesRepo.findById(noteId, userId);
      if (!note) {
        return {
          status: "error",
          externalUrl: null,
          error: "Note not found",
        };
      }

      const summaries = await summariesRepo.findByNote(noteId);
      const pageInput = buildNotionExportPage(note, summaries);
      const page = await createNotionWorkspacePage(accessToken, pageInput);

      return {
        status: "success",
        externalUrl: page.url,
      };
    } catch (error: unknown) {
      return {
        status: "error",
        externalUrl: null,
        error: error instanceof Error ? error.message : "Notion export failed",
      };
    }
  }
}

const CONNECTORS: Partial<Record<IntegrationProvider, IntegrationConnector>> = {
  NOTION: new NotionConnector(),
};

export function getIntegrationConnector(
  provider: IntegrationProvider,
): IntegrationConnector | null {
  return CONNECTORS[provider] ?? null;
}

export async function exportSummaryWithConnector(
  provider: IntegrationProvider,
  noteId: UUID,
  userId: UUID,
): Promise<IntegrationExportResult> {
  const connector = getIntegrationConnector(provider);

  if (!connector) {
    return {
      status: "error",
      externalUrl: null,
      error: `Provider ${provider} is not supported yet`,
    };
  }

  return connector.exportSummary(noteId, userId);
}
