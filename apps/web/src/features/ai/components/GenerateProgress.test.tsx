import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateProgress } from "./GenerateProgress";
import type { UseGenerateResult } from "../hooks/use-generate";

const mockGenerate = vi.fn();
const mockCancel = vi.fn();

let hookReturn: UseGenerateResult;

vi.mock("../hooks/use-generate", () => ({
  useGenerate: () => hookReturn,
}));

describe("GenerateProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookReturn = {
      generate: mockGenerate,
      jobId: null,
      status: null,
      progressPct: 0,
      message: null,
      cancel: mockCancel,
      error: null,
    };
  });

  it("renders generate button when idle", () => {
    render(<GenerateProgress noteId="note-1" />);

    expect(
      screen.getByRole("button", { name: "Generate" }),
    ).toBeInTheDocument();
  });

  it("shows progress bar when generating", () => {
    hookReturn = {
      ...hookReturn,
      jobId: "job-1",
      status: "RUNNING",
      progressPct: 45,
      message: "Processing transcript...",
    };

    render(<GenerateProgress noteId="note-1" />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Processing transcript...")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });

  it("shows cancel button during generation", async () => {
    const user = userEvent.setup();
    hookReturn = {
      ...hookReturn,
      jobId: "job-1",
      status: "RUNNING",
      progressPct: 30,
    };

    render(<GenerateProgress noteId="note-1" />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeInTheDocument();

    await user.click(cancelButton);
    expect(mockCancel).toHaveBeenCalled();
  });

  it("shows completion state with done button", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    hookReturn = {
      ...hookReturn,
      jobId: "job-1",
      status: "COMPLETED",
      progressPct: 100,
    };

    render(<GenerateProgress noteId="note-1" onComplete={onComplete} />);

    expect(screen.getByText("COMPLETED")).toBeInTheDocument();

    const doneButton = screen.getByRole("button", { name: "Done" });
    await user.click(doneButton);
    expect(onComplete).toHaveBeenCalled();
  });

  it("displays error message when generation fails", () => {
    hookReturn = {
      ...hookReturn,
      error: "Connection to job stream lost",
    };

    render(<GenerateProgress noteId="note-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Connection to job stream lost",
    );
  });
});
