import { describe, expect, it } from "vitest";
import type { Note, AISummary, UUID, ISODateString } from "@ainotes/core";
import { buildNotionExportPage } from "./notion-export";

function makeNote(): Note {
  return {
    id: "11111111-1111-1111-1111-111111111111" as UUID,
    userId: "22222222-2222-2222-2222-222222222222" as UUID,
    title: "Weekly Sync",
    contentRich: {},
    contentPlain: "raw note",
    type: "MEETING",
    tags: [],
    pinned: false,
    folderId: null,
    templateId: null,
    templateMode: "AUTO",
    templateSelectedAt: null,
    createdAt: "2026-02-15T00:00:00.000Z" as ISODateString,
    updatedAt: "2026-02-15T00:00:00.000Z" as ISODateString,
    deletedAt: null,
  };
}

function makeSummary(kind: AISummary["kind"], payload: unknown): AISummary {
  return {
    id: crypto.randomUUID() as UUID,
    noteId: "11111111-1111-1111-1111-111111111111" as UUID,
    meetingSessionId: null,
    kind,
    payload: payload as AISummary["payload"],
    modelInfo: {},
    createdAt: "2026-02-15T00:00:00.000Z" as ISODateString,
  } as AISummary;
}

describe("buildNotionExportPage", () => {
  it("builds sections from summary/action items/decisions payloads", () => {
    const note = makeNote();
    const summaries = [
      makeSummary("SUMMARY", {
        title: "Weekly Sync Summary",
        oneLiner: "Team aligned on launch timing.",
        bullets: ["Reviewed blockers", "Finalized owners"],
      }),
      makeSummary("ACTION_ITEMS", {
        items: [
          { text: "Prepare release notes", owner: "Rakesh", due: "Friday" },
        ],
      }),
      makeSummary("DECISIONS", { decisions: ["Ship in two phases"] }),
    ];

    const page = buildNotionExportPage(note, summaries);

    expect(page.title).toBe("Weekly Sync Summary");
    expect(page.children.some((b) => b.type === "heading_2")).toBe(true);
    expect(page.children.some((b) => b.type === "to_do")).toBe(true);
  });

  it("falls back when no structured summary exists", () => {
    const note = makeNote();

    const page = buildNotionExportPage(note, []);

    expect(page.title).toBe("Weekly Sync");
    expect(page.children.length).toBeGreaterThan(1);
  });
});
