import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { UUID, ISODateString } from "@ainotes/core";
import { createUserIntegrationsRepository } from "./user-integrations.repo";
import type { UserIntegrationsRepository } from "./user-integrations.repo";
import {
  getTestClient,
  cleanDatabase,
  createTestUser,
  disconnectTestClient,
} from "../test-utils/helpers";

describe("UserIntegrationsRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: UserIntegrationsRepository;
  let testUserId: UUID;
  let otherUserId: UUID;

  beforeAll(async () => {
    prisma = getTestClient();
    repo = createUserIntegrationsRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const user = await createTestUser(prisma);
    testUserId = user.id;

    const other = await createTestUser(prisma, {
      email: "other@example.com",
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await disconnectTestClient();
  });

  describe("upsert", () => {
    it("creates a new provider connection", async () => {
      const integration = await repo.upsert({
        userId: testUserId,
        provider: "NOTION",
        accessToken: "token-v1",
        refreshToken: "refresh-v1",
        expiresAt: null,
        metadataJson: { workspaceId: "abc" },
      });

      expect(integration.userId).toBe(testUserId);
      expect(integration.provider).toBe("NOTION");
      expect(integration.accessToken).toBe("token-v1");
      expect(integration.refreshToken).toBe("refresh-v1");
      expect(integration.metadataJson).toEqual({ workspaceId: "abc" });
    });

    it("updates existing connection for same user and provider", async () => {
      await repo.upsert({
        userId: testUserId,
        provider: "NOTION",
        accessToken: "token-v1",
        refreshToken: "refresh-v1",
        expiresAt: null,
        metadataJson: { workspaceId: "abc" },
      });

      const updated = await repo.upsert({
        userId: testUserId,
        provider: "NOTION",
        accessToken: "token-v2",
        refreshToken: null,
        expiresAt: "2030-01-01T00:00:00.000Z" as ISODateString,
        metadataJson: { workspaceId: "xyz" },
      });

      expect(updated.accessToken).toBe("token-v2");
      expect(updated.refreshToken).toBeNull();
      expect(updated.expiresAt).toBe("2030-01-01T00:00:00.000Z");
      expect(updated.metadataJson).toEqual({ workspaceId: "xyz" });

      const rows = await repo.findByUser(testUserId);
      expect(rows).toHaveLength(1);
    });
  });

  describe("findByUserAndProvider", () => {
    it("returns null when provider is not connected", async () => {
      const found = await repo.findByUserAndProvider(testUserId, "NOTION");
      expect(found).toBeNull();
    });

    it("returns a matching connection", async () => {
      await repo.upsert({
        userId: testUserId,
        provider: "SLACK",
        accessToken: "token",
        refreshToken: null,
        expiresAt: null,
        metadataJson: {},
      });

      const found = await repo.findByUserAndProvider(testUserId, "SLACK");
      expect(found).not.toBeNull();
      expect(found!.provider).toBe("SLACK");
    });
  });

  describe("findByUser", () => {
    it("returns only the target user's integrations", async () => {
      await repo.upsert({
        userId: testUserId,
        provider: "NOTION",
        accessToken: "token-a",
        refreshToken: null,
        expiresAt: null,
        metadataJson: {},
      });

      await repo.upsert({
        userId: otherUserId,
        provider: "SLACK",
        accessToken: "token-b",
        refreshToken: null,
        expiresAt: null,
        metadataJson: {},
      });

      const list = await repo.findByUser(testUserId);
      expect(list).toHaveLength(1);
      expect(list[0]!.provider).toBe("NOTION");
    });
  });

  describe("updateTokens", () => {
    it("updates access token and expiry", async () => {
      await repo.upsert({
        userId: testUserId,
        provider: "NOTION",
        accessToken: "token-v1",
        refreshToken: "refresh-v1",
        expiresAt: null,
        metadataJson: {},
      });

      const updated = await repo.updateTokens(testUserId, "NOTION", {
        accessToken: "token-v2",
        expiresAt: "2031-01-01T00:00:00.000Z" as ISODateString,
      });

      expect(updated.accessToken).toBe("token-v2");
      expect(updated.refreshToken).toBe("refresh-v1");
      expect(updated.expiresAt).toBe("2031-01-01T00:00:00.000Z");
    });
  });

  describe("deleteByUserAndProvider", () => {
    it("removes only the specified user/provider record", async () => {
      await repo.upsert({
        userId: testUserId,
        provider: "NOTION",
        accessToken: "token-a",
        refreshToken: null,
        expiresAt: null,
        metadataJson: {},
      });

      await repo.upsert({
        userId: testUserId,
        provider: "SLACK",
        accessToken: "token-b",
        refreshToken: null,
        expiresAt: null,
        metadataJson: {},
      });

      await repo.deleteByUserAndProvider(testUserId, "NOTION");

      const list = await repo.findByUser(testUserId);
      expect(list).toHaveLength(1);
      expect(list[0]!.provider).toBe("SLACK");
    });
  });
});
