import { describe, expect, it } from "vitest";
import {
  buildCitations,
  buildNoteWhere,
  noResultsMessage,
  rankChunks,
} from "./rag";
import type { NoteForRag } from "./rag";

describe("chat rag utilities", () => {
  it("applies folder and date filters in note query", () => {
    const where = buildNoteWhere({
      userId: "user-1",
      userEmail: "user@example.com",
      scope: "folder",
      filters: {
        folderId: "folder-123",
        dateRange: {
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-01-31T23:59:59.999Z",
        },
      },
    });

    expect(where.userId).toBe("user-1");
    expect(where.folderId).toBe("folder-123");
    expect(where.updatedAt).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-01-31T23:59:59.999Z"),
    });
  });

  it("builds citations with matching note and transcript metadata", () => {
    const notes: NoteForRag[] = [
      {
        id: "note-1",
        title: "API Planning",
        contentPlain: "We agreed to version the API and add rate limits.",
        createdAt: new Date("2026-02-01T09:00:00.000Z"),
        updatedAt: new Date("2026-02-01T09:00:00.000Z"),
        summaries: [],
        meetingSessions: [
          {
            id: "meeting-1",
            startedAt: new Date("2026-02-01T09:00:00.000Z"),
            transcriptChunks: [
              {
                id: "chunk-1",
                text: "Decision: keep REST endpoints versioned under /v1.",
                tStartMs: 1000,
                tEndMs: 4000,
                createdAt: new Date("2026-02-01T09:10:00.000Z"),
              },
            ],
          },
        ],
      },
    ];

    const ranked = rankChunks(notes, "versioned API");
    const citations = buildCitations(ranked, "versioned API");

    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0]?.noteId).toBe("note-1");
    expect(citations[0]?.title).toBe("API Planning");
    expect(
      citations.some((citation) => citation.sourceType === "transcript"),
    ).toBe(true);
    expect(
      citations.find((citation) => citation.sourceType === "transcript")
        ?.time_range_optional,
    ).toBe("1000..4000");
  });

  it("returns guardrail wording when no results exist", () => {
    const message = noResultsMessage("all_meetings");
    expect(message.toLowerCase()).toContain("couldn't find");
    expect(message).toContain("All meetings");
  });

  it("uses vector score in hybrid ranking when lexical match is weak", () => {
    const notes: NoteForRag[] = [
      {
        id: "note-a",
        title: "Budget",
        contentPlain: "Quarterly budget and hiring plan.",
        createdAt: new Date("2026-02-10T09:00:00.000Z"),
        updatedAt: new Date("2026-02-10T09:00:00.000Z"),
        summaries: [],
        meetingSessions: [],
      },
      {
        id: "note-b",
        title: "API Decision",
        contentPlain: "This discusses endpoint versioning and rollout plan.",
        createdAt: new Date("2026-02-09T09:00:00.000Z"),
        updatedAt: new Date("2026-02-09T09:00:00.000Z"),
        summaries: [],
        meetingSessions: [],
      },
    ];

    const ranked = rankChunks(notes, "versioned api", 8, {
      vectorScores: new Map([
        ["note:note-a:0", 0.05],
        ["note:note-b:0", 0.93],
      ]),
      hybridWeights: { lexical: 0.4, vector: 0.6 },
    });

    expect(ranked[0]?.noteId).toBe("note-b");
    expect(ranked[0]?.vectorScore).toBeGreaterThan(0.9);
  });
});
