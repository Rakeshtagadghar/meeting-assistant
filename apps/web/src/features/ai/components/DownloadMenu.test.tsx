import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NoteArtifact, UUID, ISODateString } from "@ainotes/core";
import { DownloadMenu } from "./DownloadMenu";

const readyPdf: NoteArtifact = {
  id: "artifact-1" as UUID,
  noteId: "note-1" as UUID,
  jobId: "job-1" as UUID,
  type: "PDF",
  status: "READY",
  storagePath: "/storage/note-1.pdf",
  hash: "abc123",
  createdAt: "2024-01-15T10:00:00.000Z" as ISODateString,
  updatedAt: "2024-01-15T10:05:00.000Z" as ISODateString,
};

const readyDocx: NoteArtifact = {
  id: "artifact-2" as UUID,
  noteId: "note-1" as UUID,
  jobId: "job-1" as UUID,
  type: "DOCX",
  status: "READY",
  storagePath: "/storage/note-1.docx",
  hash: "def456",
  createdAt: "2024-01-15T10:00:00.000Z" as ISODateString,
  updatedAt: "2024-01-15T10:05:00.000Z" as ISODateString,
};

const notReadyPdf: NoteArtifact = {
  ...readyPdf,
  id: "artifact-3" as UUID,
  status: "GENERATING",
  storagePath: null,
  hash: null,
};

const notReadyDocx: NoteArtifact = {
  ...readyDocx,
  id: "artifact-4" as UUID,
  status: "NOT_READY",
  storagePath: null,
  hash: null,
};

function getDownloadTrigger() {
  // The Dropdown wrapper adds role="button" on the div, and the inner Button is also a button.
  // We want the actual <button> element with text "Download".
  const buttons = screen.getAllByRole("button", { name: "Download" });
  // The inner <button> is the actual trigger
  const btn = buttons.find((el) => el.tagName === "BUTTON");
  if (!btn) throw new Error("Download button not found");
  return btn;
}

describe("DownloadMenu", () => {
  it("renders download trigger button", () => {
    render(<DownloadMenu artifacts={[readyPdf, readyDocx]} noteId="note-1" />);

    expect(getDownloadTrigger()).toBeInTheDocument();
  });

  it("shows PDF and DOCX options when dropdown is opened", async () => {
    const user = userEvent.setup();
    render(
      <DownloadMenu
        artifacts={[readyPdf, readyDocx]}
        noteId="note-1"
        notionConnected
      />,
    );

    await user.click(getDownloadTrigger());

    expect(
      screen.getByRole("menuitem", { name: "Download PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Download DOCX" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Export to Notion" }),
    ).toBeInTheDocument();
  });

  it("hides notion export option when notion is disconnected", async () => {
    const user = userEvent.setup();
    render(
      <DownloadMenu
        artifacts={[readyPdf, readyDocx]}
        noteId="note-1"
        notionConnected={false}
      />,
    );

    await user.click(getDownloadTrigger());

    expect(
      screen.queryByRole("menuitem", { name: "Export to Notion" }),
    ).not.toBeInTheDocument();
  });

  it.skip("disables options when artifacts are not READY", async () => {
    const user = userEvent.setup();
    render(
      <DownloadMenu artifacts={[notReadyPdf, notReadyDocx]} noteId="note-1" />,
    );

    await user.click(getDownloadTrigger());

    expect(
      screen.getByRole("menuitem", { name: "Download PDF" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Download DOCX" }),
    ).toBeDisabled();
  });
});
