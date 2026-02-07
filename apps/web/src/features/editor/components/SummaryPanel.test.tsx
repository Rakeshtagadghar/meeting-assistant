import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  UUID,
  ISODateString,
  AISummary,
  NoteArtifact,
} from "@ainotes/core";
import { SummaryPanel } from "./SummaryPanel";

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

// ─── Fixtures ───

const makeSummary = (overrides: Partial<AISummary> = {}): AISummary =>
  ({
    id: "summary-1" as UUID,
    noteId: "note-1" as UUID,
    meetingSessionId: null,
    kind: "SUMMARY" as const,
    payload: {
      title: "Meeting Summary",
      bullets: ["Point one", "Point two"],
      oneLiner: "Quick overview of meeting",
    },
    modelInfo: { model: "gpt-4" },
    createdAt: "2025-01-01T00:00:00.000Z" as ISODateString,
    ...overrides,
  }) as AISummary;

const makeArtifact = (overrides: Partial<NoteArtifact> = {}): NoteArtifact => ({
  id: "artifact-1" as UUID,
  noteId: "note-1" as UUID,
  jobId: "job-1" as UUID,
  type: "PDF",
  status: "READY",
  storagePath: "/exports/test.pdf",
  hash: "abc123",
  createdAt: "2025-01-01T00:00:00.000Z" as ISODateString,
  updatedAt: "2025-01-01T00:00:00.000Z" as ISODateString,
  ...overrides,
});

describe("SummaryPanel", () => {
  it('renders "No summaries" when empty', () => {
    render(<SummaryPanel summaries={[]} artifacts={[]} />);

    expect(screen.getByText(/no summaries yet/i)).toBeInTheDocument();
  });

  it("renders summary content", () => {
    const summary = makeSummary();

    render(<SummaryPanel summaries={[summary]} artifacts={[]} />);

    expect(screen.getByText("Meeting Summary")).toBeInTheDocument();
    expect(screen.getByText("Quick overview of meeting")).toBeInTheDocument();
    expect(screen.getByText("Point one")).toBeInTheDocument();
    expect(screen.getByText("Point two")).toBeInTheDocument();
  });

  it("shows download button for READY artifacts", () => {
    const artifact = makeArtifact({ status: "READY", type: "PDF" });

    render(<SummaryPanel summaries={[]} artifacts={[artifact]} />);

    const downloadButton = screen.getByRole("button", {
      name: "Download PDF",
    });
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).not.toBeDisabled();
  });

  it("disables download for NOT_READY artifacts", () => {
    const artifact = makeArtifact({
      id: "artifact-2" as UUID,
      status: "NOT_READY",
      type: "DOCX",
      storagePath: null,
      hash: null,
    });

    render(<SummaryPanel summaries={[]} artifacts={[artifact]} />);

    const downloadButton = screen.getByRole("button", {
      name: "Download DOCX",
    });
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).toBeDisabled();
  });
});
