import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UUID, ISODateString, Note } from "@ainotes/core";
import { NotesListView } from "./NotesListView";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/notes",
}));

const mockNotes: Note[] = [
  {
    id: "note-1" as UUID,
    userId: "user-1" as UUID,
    title: "First Note",
    contentPlain: "Content of first note",
    contentRich: null,
    type: "FREEFORM",
    tags: ["personal"],
    pinned: false,
    folderId: null,
    deletedAt: null,
    createdAt: "2024-01-10T10:00:00.000Z" as ISODateString,
    updatedAt: "2024-01-15T10:00:00.000Z" as ISODateString,
  },
  {
    id: "note-2" as UUID,
    userId: "user-1" as UUID,
    title: "Second Note",
    contentPlain: "Content of second note",
    contentRich: null,
    type: "MEETING",
    tags: ["work"],
    pinned: true,
    folderId: null,
    deletedAt: null,
    createdAt: "2024-01-12T10:00:00.000Z" as ISODateString,
    updatedAt: "2024-01-18T10:00:00.000Z" as ISODateString,
  },
];

vi.mock("@/features/notes/hooks/use-notes", () => ({
  useNotes: vi.fn(),
}));

import { useNotes } from "@/features/notes/hooks/use-notes";

const mockUseNotes = vi.mocked(useNotes);

describe("NotesListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading spinner when loading", () => {
    mockUseNotes.mockReturnValue({
      notes: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<NotesListView />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders empty state when there are no notes", () => {
    mockUseNotes.mockReturnValue({
      notes: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NotesListView />);

    expect(
      screen.getByRole("heading", { name: "No notes yet" }),
    ).toBeInTheDocument();
  });

  it("renders a list of NoteCards when notes exist", () => {
    mockUseNotes.mockReturnValue({
      notes: mockNotes,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NotesListView />);

    expect(screen.getByText("First Note")).toBeInTheDocument();
    expect(screen.getByText("Second Note")).toBeInTheDocument();
  });

  it("renders the search bar", () => {
    mockUseNotes.mockReturnValue({
      notes: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NotesListView />);

    expect(screen.getByPlaceholderText("Search notes...")).toBeInTheDocument();
  });

  it("renders the New Note button", () => {
    mockUseNotes.mockReturnValue({
      notes: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NotesListView />);

    expect(
      screen.getByRole("button", { name: "New Note" }),
    ).toBeInTheDocument();
  });
});
