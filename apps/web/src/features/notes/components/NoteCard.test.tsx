import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UUID, ISODateString, Note } from "@ainotes/core";
import { NoteCard } from "./NoteCard";

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

const mockNote: Note = {
  id: "note-1" as UUID,
  userId: "user-1" as UUID,
  title: "Weekly Standup Notes",
  contentPlain: "Discussed project timeline",
  contentRich: null,
  type: "MEETING",
  tags: ["engineering", "standup"],
  pinned: false,
  folderId: null,
  deletedAt: null,
  createdAt: "2024-01-15T10:00:00.000Z" as ISODateString,
  updatedAt: "2024-01-20T14:30:00.000Z" as ISODateString,
  templateId: null,
  templateMode: "AUTO",
  templateSelectedAt: null,
};

describe("NoteCard", () => {
  it("renders the note title", () => {
    render(<NoteCard note={mockNote} />);

    expect(screen.getByText("Weekly Standup Notes")).toBeInTheDocument();
  });

  it("renders author label", () => {
    render(<NoteCard note={mockNote} />);

    expect(screen.getByText("Me")).toBeInTheDocument();
  });

  it("calls onPin when pin button is clicked", async () => {
    const user = userEvent.setup();
    const handlePin = vi.fn();

    render(<NoteCard note={mockNote} onPin={handlePin} />);

    const pinButton = screen.getByLabelText("Pin note");
    await user.click(pinButton);

    expect(handlePin).toHaveBeenCalledWith("note-1");
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();

    render(<NoteCard note={mockNote} onDelete={handleDelete} />);

    const deleteButton = screen.getByLabelText("Delete note");
    await user.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith("note-1");
  });

  it("links to the note detail page", () => {
    render(<NoteCard note={mockNote} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/note/note-1");
  });

  it("shows pin indicator when note is pinned", () => {
    const pinnedNote: Note = { ...mockNote, pinned: true };

    render(<NoteCard note={pinnedNote} />);

    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("renders the updated time", () => {
    render(<NoteCard note={mockNote} />);

    // The time should be displayed (format depends on locale)
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });
});
