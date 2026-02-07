import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  UUID,
  ISODateString,
  Note,
  AISummary,
  NoteArtifact,
} from "@ainotes/core";
import { NoteEditor } from "./NoteEditor";

// ─── Mock hooks ───

const mockNote: Note = {
  id: "note-1" as UUID,
  userId: "user-1" as UUID,
  title: "Test Note Title",
  contentRich: { type: "doc", content: [] },
  contentPlain: "Some plain text content",
  type: "FREEFORM",
  tags: ["react", "typescript"],
  pinned: false,
  folderId: null,
  createdAt: "2025-01-01T00:00:00.000Z" as ISODateString,
  updatedAt: "2025-01-01T00:00:00.000Z" as ISODateString,
  deletedAt: null,
};

const mockUseNoteLoading = {
  note: null,
  summaries: [] as AISummary[],
  artifacts: [] as NoteArtifact[],
  loading: true,
  error: null,
  refetch: vi.fn(),
};

const mockUseNoteLoaded = {
  note: mockNote,
  summaries: [] as AISummary[],
  artifacts: [] as NoteArtifact[],
  loading: false,
  error: null,
  refetch: vi.fn(),
};

const mockSave = vi.fn();

const mockUseAutosave = {
  save: mockSave,
  saving: false,
  lastSaved: null,
  error: null,
};

vi.mock("../hooks/use-note", () => ({
  useNote: vi.fn(() => mockUseNoteLoading),
}));

vi.mock("../hooks/use-autosave", () => ({
  useAutosave: vi.fn(() => mockUseAutosave),
}));

// ─── Mock next/navigation ───

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/note/test-id",
}));

// ─── Mock next/link ───

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ─── Import mocked module for per-test override ───

import { useNote } from "../hooks/use-note";

const mockedUseNote = vi.mocked(useNote);

describe("NoteEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while loading", () => {
    mockedUseNote.mockReturnValue(mockUseNoteLoading);

    render(<NoteEditor noteId="note-1" />);

    expect(screen.getByTestId("editor-loading")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders title input with note title", () => {
    mockedUseNote.mockReturnValue(mockUseNoteLoaded);

    render(<NoteEditor noteId="note-1" />);

    const titleInput = screen.getByLabelText("Note title");
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toHaveValue("Test Note Title");
  });

  it("renders content area", () => {
    mockedUseNote.mockReturnValue(mockUseNoteLoaded);

    render(<NoteEditor noteId="note-1" />);

    const contentArea = screen.getByLabelText("Note content");
    expect(contentArea).toBeInTheDocument();
    expect(contentArea).toHaveValue("Some plain text content");
  });

  it("renders tags as badges", () => {
    mockedUseNote.mockReturnValue(mockUseNoteLoaded);

    render(<NoteEditor noteId="note-1" />);

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("renders pin toggle button", () => {
    mockedUseNote.mockReturnValue(mockUseNoteLoaded);

    render(<NoteEditor noteId="note-1" />);

    const pinButton = screen.getByRole("button", { name: "Pin note" });
    expect(pinButton).toBeInTheDocument();
    expect(pinButton).toHaveAttribute("aria-pressed", "false");
  });
});
