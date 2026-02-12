import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { UUID, ISODateString, NoteArtifact } from "@ainotes/core";
import { SummaryPanel } from "./SummaryPanel";

// ─── Mock hooks ───

const mockSave = vi.fn();
const mockReplace = vi.fn();
const mockSnapshot = vi.fn();
const mockSetHistory = vi.fn();

vi.mock("../hooks/use-artifact-autosave", () => ({
  useArtifactAutosave: () => ({
    save: mockSave,
    saving: false,
    lastSaved: null,
    error: null,
  }),
}));

vi.mock("../../../hooks/use-history", () => ({
  useHistory: (initial: string) => ({
    state: initial,
    replace: mockReplace,
    snapshot: mockSnapshot,
    set: mockSetHistory,
    handleKeyDown: vi.fn(),
  }),
}));

// Mock Streamdown to avoid complex rendering in tests
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="streamdown-preview">{children}</div>
  ),
}));

// ─── Fixtures ───

const makeArtifact = (overrides: Partial<NoteArtifact> = {}): NoteArtifact => ({
  id: "artifact-1" as UUID,
  noteId: "note-1" as UUID,
  jobId: "job-1" as UUID,
  type: "MARKDOWN_SUMMARY",
  status: "READY",
  storagePath: "# Summary\nContent here",
  hash: "abc123",
  createdAt: "2025-01-01T00:00:00.000Z" as ISODateString,
  updatedAt: "2025-01-01T00:00:00.000Z" as ISODateString,
  ...overrides,
});

describe("SummaryPanel", () => {
  it('renders "Preview" by default when markdown artifact exists', () => {
    const artifact = makeArtifact();
    render(
      <SummaryPanel noteId="note-1" summaries={[]} artifacts={[artifact]} />,
    );

    expect(screen.getByText(/# Summary/)).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Summary content..."),
    ).not.toBeInTheDocument();
  });

  it("switches to Edit mode and shows textarea", () => {
    const artifact = makeArtifact();
    render(
      <SummaryPanel noteId="note-1" summaries={[]} artifacts={[artifact]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const textarea = screen.getByPlaceholderText("Summary content...");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("# Summary\nContent here");
  });

  it("calls replace and save on change in Edit mode", () => {
    const artifact = makeArtifact();
    render(
      <SummaryPanel noteId="note-1" summaries={[]} artifacts={[artifact]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByPlaceholderText("Summary content...");
    fireEvent.change(textarea, { target: { value: "New content" } });

    expect(mockReplace).toHaveBeenCalledWith("New content");
    expect(mockSave).toHaveBeenCalledWith("New content");
  });

  it("switches to Transcript mode", () => {
    const artifact = makeArtifact();
    render(
      <SummaryPanel noteId="note-1" summaries={[]} artifacts={[artifact]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Transcript" }));

    expect(
      screen.getByPlaceholderText("Start typing or dictate..."),
    ).toBeInTheDocument();
  });

  it("shows dictation content in Transcript mode", () => {
    const artifact = makeArtifact();
    const dictation = {
      isListening: true,
      transcript: "Hello world",
      partialText: "...",
      toggleRecording: vi.fn(),
    };

    render(
      <SummaryPanel
        noteId="note-1"
        summaries={[]}
        artifacts={[artifact]}
        dictation={dictation}
        transcriptContent="Existing transcript content"
      />,
    );

    // Switch to transcript tab
    fireEvent.click(screen.getByRole("button", { name: "Transcript" }));

    // Should show the textarea with content
    expect(
      screen.getByDisplayValue("Existing transcript content"),
    ).toBeInTheDocument();

    // Should show active recording indicator
    expect(screen.getByText("Recording...")).toBeInTheDocument();
  });

  it("calls onTranscriptChange when typing in Transcript mode", () => {
    const artifact = makeArtifact();
    const mockOnTranscriptChange = vi.fn();

    render(
      <SummaryPanel
        noteId="note-1"
        summaries={[]}
        artifacts={[artifact]}
        transcriptContent="Old content"
        onTranscriptChange={mockOnTranscriptChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Transcript" }));

    const textarea = screen.getByDisplayValue("Old content");
    fireEvent.change(textarea, { target: { value: "New content" } });

    expect(mockOnTranscriptChange).toHaveBeenCalledWith("New content");
  });

  it("toggles recording when Dictate button clicked", () => {
    const artifact = makeArtifact();
    const mockToggle = vi.fn();
    const dictation = {
      isListening: false,
      transcript: "",
      partialText: "",
      toggleRecording: mockToggle,
    };

    render(
      <SummaryPanel
        noteId="note-1"
        summaries={[]}
        artifacts={[artifact]}
        dictation={dictation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));

    expect(mockToggle).toHaveBeenCalled();
  });
});
