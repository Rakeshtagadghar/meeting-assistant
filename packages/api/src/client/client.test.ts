import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProcessingJobKind,
  ShareVisibility,
  IntegrationProvider,
  type UUID,
} from "@ainotes/core";
import { createApiClient, type ApiClient } from "./index";

// ─── Shared helpers ───

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

let client: ApiClient;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);

  client = createApiClient({
    baseUrl: "https://api.test",
    headers: { Authorization: "Bearer tok_123" },
  });
});

// ─── Notes ───

describe("notes", () => {
  it("create sends POST /api/notes with body", async () => {
    const body = { title: "Hello", contentRich: { ops: [] } };
    const response = { noteId: "n-1" };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.notes.create(body);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  });

  it("list sends GET /api/notes with query params", async () => {
    const response = { notes: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.notes.list({ q: "meeting", pinned: true });

    expect(result).toEqual(response);
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/api/notes?");
    expect(calledUrl).toContain("q=meeting");
    expect(calledUrl).toContain("pinned=true");
  });

  it("get sends GET /api/notes/:id", async () => {
    const response = { note: {}, summaries: [], artifacts: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.notes.get("n-1");

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/notes/n-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("update sends PATCH /api/notes/:id with body", async () => {
    const body = { title: "Updated" };
    const response = { ok: true as const };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.notes.update("n-1", body);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/notes/n-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  });

  it("delete sends DELETE /api/notes/:id", async () => {
    const response = { ok: true as const };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.notes.delete("n-1");

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/notes/n-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

// ─── AI ───

describe("ai", () => {
  it("generate sends POST /api/ai/generate", async () => {
    const body = {
      noteId: "n-1" as UUID,
      kinds: [ProcessingJobKind.SUMMARIZE],
    };
    const response = { jobId: "j-1" };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.ai.generate(body);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/ai/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  });
});

// ─── Jobs ───

describe("jobs", () => {
  it("getStatus sends GET /api/jobs/:id", async () => {
    const response = { job: {}, artifacts: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.jobs.getStatus("j-1");

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/jobs/j-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("cancel sends POST /api/jobs/:id/cancel", async () => {
    const response = { ok: true as const };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.jobs.cancel("j-1");

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/jobs/j-1/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

// ─── Share ───

describe("share", () => {
  it("createLink sends POST /api/share-links", async () => {
    const body = {
      noteId: "n-1" as UUID,
      visibility: ShareVisibility.PRIVATE,
      allowedEmails: [] as string[],
    };
    const response = { token: "tok_abc" };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.share.createLink(body);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/share-links",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  });

  it("getShared sends GET /api/shared/:token", async () => {
    const response = { noteReadOnly: {}, summaries: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.share.getShared("tok_abc");

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/shared/tok_abc",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

// ─── Integrations ───

describe("integrations", () => {
  it("list sends GET /api/integrations", async () => {
    const response = { integrations: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.integrations.list();

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/integrations",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("disconnect sends DELETE /api/integrations with provider", async () => {
    const body = { provider: IntegrationProvider.NOTION };
    const response = { ok: true as const };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.integrations.disconnect(body);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/integrations",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    );
  });

  it("exportSummary sends POST /api/integrations/export", async () => {
    const body = {
      noteId: "n-1" as UUID,
      provider: IntegrationProvider.NOTION,
    };
    const response = { status: "success" as const, externalUrl: "https://x.y" };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    const result = await client.integrations.exportSummary(body);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/api/integrations/export",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  });
});

// ─── Error handling ───

describe("error handling", () => {
  it("throws on non-2xx response with error message", async () => {
    const errorBody = {
      error: { code: "NOT_FOUND", message: "Note not found" },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(errorBody, 404));

    await expect(client.notes.get("missing")).rejects.toThrow("Note not found");
  });
});

// ─── Custom headers ───

describe("custom headers", () => {
  it("includes custom headers from config", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ notes: [] }));

    await client.notes.list();

    const calledInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tok_123");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
