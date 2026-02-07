"use client";

import type { AISummary, NoteArtifact } from "@ainotes/core";
import { Button, Card } from "@ainotes/ui";

export interface SummaryPanelProps {
  summaries: AISummary[];
  artifacts: NoteArtifact[];
}

const KIND_LABELS: Record<string, string> = {
  SUMMARY: "Summary",
  ACTION_ITEMS: "Action Items",
  DECISIONS: "Decisions",
  RISKS: "Risks",
  KEY_POINTS: "Key Points",
};

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  MARKDOWN_SUMMARY: "Markdown",
  HTML_SUMMARY: "HTML",
  PDF: "PDF",
  DOCX: "DOCX",
};

function renderSummaryContent(summary: AISummary): React.ReactNode {
  switch (summary.kind) {
    case "SUMMARY":
      return (
        <div>
          <p className="font-medium">{summary.payload.title}</p>
          <p className="text-sm text-gray-600">{summary.payload.oneLiner}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            {summary.payload.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      );
    case "ACTION_ITEMS":
      return (
        <ul className="list-inside list-disc text-sm">
          {summary.payload.items.map((item, i) => (
            <li key={i}>
              {item.text}
              {item.owner && (
                <span className="ml-1 text-gray-500">({item.owner})</span>
              )}
            </li>
          ))}
        </ul>
      );
    case "DECISIONS":
      return (
        <ul className="list-inside list-disc text-sm">
          {summary.payload.decisions.map((decision, i) => (
            <li key={i}>{decision}</li>
          ))}
        </ul>
      );
    case "RISKS":
      return (
        <ul className="list-inside list-disc text-sm">
          {summary.payload.risks.map((risk, i) => (
            <li key={i}>{risk}</li>
          ))}
        </ul>
      );
    case "KEY_POINTS":
      return (
        <div>
          <p className="text-sm text-gray-600">{summary.payload.oneLiner}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            {summary.payload.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      );
  }
}

export function SummaryPanel({ summaries, artifacts }: SummaryPanelProps) {
  if (summaries.length === 0 && artifacts.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 p-4 text-center text-sm text-gray-500">
        No summaries yet. Generate AI summaries to see them here.
      </div>
    );
  }

  // Group summaries by kind
  const groupedSummaries = summaries.reduce<Record<string, AISummary[]>>(
    (acc, summary) => {
      const kind = summary.kind;
      if (!acc[kind]) {
        acc[kind] = [];
      }
      acc[kind].push(summary);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summaries */}
      {Object.entries(groupedSummaries).map(([kind, kindSummaries]) => (
        <Card key={kind} className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            {KIND_LABELS[kind] ?? kind}
          </h3>
          <div className="flex flex-col gap-3">
            {kindSummaries.map((summary) => (
              <div key={summary.id}>{renderSummaryContent(summary)}</div>
            ))}
          </div>
        </Card>
      ))}

      {/* Artifacts */}
      {artifacts.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Exports</h3>
          <div className="flex flex-wrap gap-2">
            {artifacts.map((artifact) => {
              const isReady = artifact.status === "READY";
              return (
                <Button
                  key={artifact.id}
                  variant="secondary"
                  disabled={!isReady}
                  aria-label={`Download ${ARTIFACT_TYPE_LABELS[artifact.type] ?? artifact.type}`}
                  onClick={() => {
                    if (isReady && artifact.storagePath) {
                      window.open(artifact.storagePath, "_blank");
                    }
                  }}
                >
                  {ARTIFACT_TYPE_LABELS[artifact.type] ?? artifact.type}
                  {!isReady && ` (${artifact.status.toLowerCase()})`}
                </Button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
