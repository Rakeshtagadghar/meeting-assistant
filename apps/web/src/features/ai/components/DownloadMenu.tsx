"use client";

import { useCallback } from "react";
import { Button, Dropdown } from "@ainotes/ui";
import type { DropdownItem } from "@ainotes/ui";
import type { NoteArtifact } from "@ainotes/core";
import { canDownload } from "@ainotes/core";

export interface DownloadMenuProps {
  artifacts: NoteArtifact[];
  noteId: string;
}

export function DownloadMenu({ artifacts, noteId }: DownloadMenuProps) {
  const pdfArtifact = artifacts.find((a) => a.type === "PDF");
  const docxArtifact = artifacts.find((a) => a.type === "DOCX");

  const handleDownload = useCallback(
    (type: string) => {
      window.open(
        `/api/notes/${noteId}/download/${type.toLowerCase()}`,
        "_blank",
      );
    },
    [noteId],
  );

  const items: DropdownItem[] = [
    {
      label: "Download PDF",
      onClick: () => handleDownload("pdf"),
      disabled: !pdfArtifact || !canDownload(pdfArtifact),
    },
    {
      label: "Download DOCX",
      onClick: () => handleDownload("docx"),
      disabled: !docxArtifact || !canDownload(docxArtifact),
    },
  ];

  return (
    <Dropdown
      trigger={<Button variant="secondary">Download</Button>}
      items={items}
      align="right"
    />
  );
}
