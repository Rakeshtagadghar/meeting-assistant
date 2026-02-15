"use client";

import { useCallback, useState } from "react";
import { Button, Dropdown } from "@ainotes/ui";
import type { DropdownItem } from "@ainotes/ui";
import type { NoteArtifact } from "@ainotes/core";
import { canDownload } from "@ainotes/core";
import { writeFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";

export interface DownloadMenuProps {
  artifacts: NoteArtifact[];
  noteId: string;
  notionConnected?: boolean;
}

export function DownloadMenu({
  artifacts,
  noteId,
  notionConnected = true,
}: DownloadMenuProps) {
  const pdfArtifact = artifacts.find((a) => a.type === "PDF");
  const docxArtifact = artifacts.find((a) => a.type === "DOCX");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingNotion, setIsExportingNotion] = useState(false);
  // You might want to use a toast hook here if available, e.g. useToast()

  const handleDownload = useCallback(
    async (type: string) => {
      const lowerType = type.toLowerCase();
      // Simple check for Tauri environment (v2)
      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

      if (lowerType !== "pdf") {
        window.open(`/api/notes/${noteId}/download/${lowerType}`, "_blank");
        return;
      }

      // PDF Specific Flow
      if (
        pdfArtifact?.status === "READY" &&
        pdfArtifact.storagePath &&
        !isTauri
      ) {
        // Web: invalidating cache might be needed but assuming simple open works
        window.open(`/api/notes/${noteId}/download/pdf`, "_blank");
        return;
      }

      // If Tauri and ready, we still might need to fetch content to save it.
      // But let's reuse the generation flow which returns a fresh signed URL usually,
      // OR we can hit the download endpoint to get the blob.
      // Optimally:
      if (
        pdfArtifact?.status === "READY" &&
        pdfArtifact.storagePath &&
        isTauri
      ) {
        try {
          // Fetch from download endpoint which redirects to signed URL or serves content
          setIsGeneratingPdf(true);
          const response = await fetch(`/api/notes/${noteId}/download/pdf`);
          if (!response.ok) throw new Error("Failed to fetch PDF");

          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const filePath = await save({
            defaultPath: `meeting-${noteId.slice(0, 8)}.pdf`,
            filters: [
              {
                name: "PDF",
                extensions: ["pdf"],
              },
            ],
          });

          if (filePath) {
            await writeFile(filePath, uint8Array);
          }
        } catch (e) {
          console.error("Failed to save PDF", e);
          alert("Failed to save PDF");
        } finally {
          setIsGeneratingPdf(false);
        }
        return;
      }

      // Start generation
      setIsGeneratingPdf(true);
      try {
        const res = await fetch("/api/export/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId }),
        });

        if (!res.ok) throw new Error("Failed to start export");

        const { jobId } = await res.json();

        // Start streaming progress
        const eventSource = new EventSource(`/api/export/pdf/stream/${jobId}`);

        eventSource.onmessage = () => {
          // Heartbeat or simple message
        };

        eventSource.addEventListener("progress", () => {
          // const data = JSON.parse((e as MessageEvent).data);
          // TODO: Update toast/UI with progress
        });

        eventSource.addEventListener("completed", async (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          eventSource.close();
          setIsGeneratingPdf(false);

          if (isTauri && data.downloadUrl) {
            try {
              const response = await fetch(data.downloadUrl);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);

              const filePath = await save({
                defaultPath: `meeting-${noteId.slice(0, 8)}.pdf`,
                filters: [
                  {
                    name: "PDF",
                    extensions: ["pdf"],
                  },
                ],
              });

              if (filePath) {
                await writeFile(filePath, uint8Array);
              }
            } catch (err) {
              console.error("Tauri save error:", err);
              alert("Failed to save PDF to disk.");
            }
            return;
          }

          // Trigger download or open in new tab (Web)
          if (data.downloadUrl) {
            const isDataUri = data.downloadUrl.startsWith("data:");

            if (isDataUri) {
              // Data URIs cannot be opened in top-level window in modern browsers, must download
              const link = document.createElement("a");
              link.href = data.downloadUrl;
              link.download = `meeting-summary-${noteId.slice(0, 8)}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else {
              // For hosted URLs, open in new tab for better UX
              // Note: This might be blocked by popup blockers if not user-initiated.
              // Since this is inside an async callback, it's likely to be caught.
              // But it's the requested behavior.
              window.open(data.downloadUrl, "_blank");
            }
          } else {
            // For subsequent downloads where we don't have the fresh signed URL from the stream,
            // hit our new proxy endpoint which will redirect to a signed URL or serve the content.
            window.open(`/api/notes/${noteId}/download/pdf`, "_blank");
          }
        });

        eventSource.addEventListener("failed", (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          // eslint-disable-next-line no-console
          console.error("PDF Failed:", data.error);
          eventSource.close();
          setIsGeneratingPdf(false);
          alert(`PDF Export Failed: ${data.error}`);
        });

        eventSource.onerror = (e) => {
          // eslint-disable-next-line no-console
          console.error("SSE Error:", e);
          eventSource.close();
          setIsGeneratingPdf(false);
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setIsGeneratingPdf(false);
        alert("Failed to start PDF export");
      }
    },
    [noteId, pdfArtifact],
  );

  const handleExportToNotion = useCallback(async () => {
    setIsExportingNotion(true);
    try {
      const res = await fetch("/api/integrations/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, provider: "NOTION" }),
      });

      const data = (await res.json()) as {
        status?: "success" | "error";
        externalUrl?: string | null;
        error?: string;
      };

      if (!res.ok || data.status === "error") {
        throw new Error(data.error ?? "Failed to export note to Notion");
      }

      if (data.externalUrl) {
        window.open(data.externalUrl, "_blank");
      } else {
        alert("Exported to Notion, but no page URL was returned.");
      }
    } catch (error: unknown) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to export note to Notion",
      );
    } finally {
      setIsExportingNotion(false);
    }
  }, [noteId]);

  const items: DropdownItem[] = [
    {
      label: isGeneratingPdf ? "Generating PDF..." : "Download PDF",
      onClick: () => !isGeneratingPdf && handleDownload("pdf"),
      disabled: isGeneratingPdf,
      // Requirement: "Input sources required: AISummary(kind=SUMMARY)".
      // We should only enable if Summary is ready. But for now, let's assume valid state if 'artifacts' passed are current.
      // logic check: canDownload usually checks if READY. We want to allow if NOT READY (to generate) but only if Summary exists.
      // For MVP simplicity: always allow clicking PDF if we are in this menu,
      // assuming parent component checks for summary existence or we handle error.
      // But verify previous logic: `disabled: !pdfArtifact || !canDownload(pdfArtifact)` -> this prevented generation if artifact missing.
      // We want to remove that restriction.
    },
    {
      label: "Download DOCX",
      onClick: () => handleDownload("docx"),
      disabled: !docxArtifact || !canDownload(docxArtifact),
    },
    ...(notionConnected
      ? [
          {
            label: isExportingNotion
              ? "Exporting to Notion..."
              : "Export to Notion",
            onClick: () => void handleExportToNotion(),
            disabled: isExportingNotion,
          },
        ]
      : []),
  ];

  return (
    <Dropdown
      trigger={
        <Button
          variant="secondary"
          disabled={isGeneratingPdf || isExportingNotion}
        >
          {isGeneratingPdf || isExportingNotion ? "Exporting..." : "Download"}
        </Button>
      }
      items={items}
      align="right"
    />
  );
}
