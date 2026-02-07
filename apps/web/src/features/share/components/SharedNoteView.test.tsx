import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { UUID, ISODateString, Note, AISummary } from "@ainotes/core";
import type { GetSharedNoteResponse } from "@ainotes/api";
import { SharedNoteView } from "./SharedNoteView";

const mockNote: Note = {
  id: "note-1" as UUID,
  userId: "user-1" as UUID,
  title: "Team Sync - Q1 Planning",
  contentPlain: "We discussed the roadmap for Q1.\nAction items were assigned.",
  contentRich: null,
  type: "MEETING",
  tags: ["planning", "q1"],
  pinned: false,
  folderId: null,
  deletedAt: null,
  createdAt: "2024-01-15T10:00:00.000Z" as ISODateString,
  updatedAt: "2024-01-20T14:30:00.000Z" as ISODateString,
};

const mockSummaries: AISummary[] = [
  {
    id: "summary-1" as UUID,
    noteId: "note-1" as UUID,
    meetingSessionId: null,
    kind: "SUMMARY",
    payload: {
      title: "Q1 Planning Summary",
      bullets: ["Roadmap approved", "Budget allocated"],
      oneLiner: "Team aligned on Q1 goals",
    },
    modelInfo: null,
    createdAt: "2024-01-15T11:00:00.000Z" as ISODateString,
  },
];

const mockResponse: GetSharedNoteResponse = {
  noteReadOnly: mockNote,
  summaries: mockSummaries,
};

describe("SharedNoteView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading spinner initially", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(<SharedNoteView token="abc123" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders note title after loading", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    render(<SharedNoteView token="abc123" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Team Sync - Q1 Planning",
        }),
      ).toBeInTheDocument();
    });
  });

  it("renders read-only content", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    render(<SharedNoteView token="abc123" />);

    await waitFor(() => {
      expect(screen.getByTestId("note-content")).toHaveTextContent(
        "We discussed the roadmap for Q1.",
      );
    });
  });

  it("shows error for invalid token", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    render(<SharedNoteView token="invalid-token" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Shared note not found",
      );
    });
  });
});
