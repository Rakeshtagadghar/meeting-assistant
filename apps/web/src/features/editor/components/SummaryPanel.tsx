"use client";

import { Streamdown } from "streamdown";
import type { AISummary, NoteArtifact } from "@ainotes/core";

export interface SummaryPanelProps {
  summaries: AISummary[];
  artifacts: NoteArtifact[];
  isGenerating?: boolean;
}

const KIND_LABELS: Record<string, string> = {
  SUMMARY: "Summary",
  ACTION_ITEMS: "Action items",
  DECISIONS: "Decisions",
  RISKS: "Risks",
  KEY_POINTS: "Key points",
};

const KIND_ICONS: Record<string, string> = {
  SUMMARY:
    "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z",
  ACTION_ITEMS:
    "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  DECISIONS: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z",
  RISKS:
    "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  KEY_POINTS:
    "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z",
};

function SectionIcon({ kind }: { kind: string }) {
  const path = KIND_ICONS[kind];
  if (!path) return null;
  return (
    <svg
      className="h-4 w-4 text-warm-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function renderSummaryContent(summary: AISummary): React.ReactNode {
  switch (summary.kind) {
    case "SUMMARY":
      return (
        <div className="space-y-2">
          {summary.payload.title && (
            <p className="text-[15px] font-medium text-gray-900">
              {summary.payload.title}
            </p>
          )}
          {summary.payload.oneLiner && (
            <p className="text-sm leading-relaxed text-warm-500">
              {summary.payload.oneLiner}
            </p>
          )}
          <ul className="space-y-1.5 pt-1">
            {summary.payload.bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-gray-700"
              >
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-warm-400" />
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "ACTION_ITEMS":
      return (
        <ul className="space-y-2">
          {summary.payload.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-warm-300 bg-warm-50">
                <svg
                  className="h-2.5 w-2.5 text-warm-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </span>
              <span className="leading-relaxed text-gray-700">
                {item.text}
                {item.owner && (
                  <span className="ml-1.5 rounded-full bg-warm-100 px-2 py-0.5 text-xs font-medium text-warm-500">
                    {item.owner}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      );
    case "DECISIONS":
      return (
        <ul className="space-y-1.5">
          {summary.payload.decisions.map((decision, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-gray-700"
            >
              <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-warm-400" />
              <span className="leading-relaxed">{decision}</span>
            </li>
          ))}
        </ul>
      );
    case "RISKS":
      return (
        <ul className="space-y-1.5">
          {summary.payload.risks.map((risk, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-gray-700"
            >
              <span className="mt-1.5 flex h-2 w-2 flex-shrink-0 items-center justify-center text-amber-500">
                <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="4" />
                </svg>
              </span>
              <span className="leading-relaxed">{risk}</span>
            </li>
          ))}
        </ul>
      );
    case "KEY_POINTS":
      return (
        <div className="space-y-2">
          {summary.payload.oneLiner && (
            <p className="text-sm leading-relaxed text-warm-500">
              {summary.payload.oneLiner}
            </p>
          )}
          <ul className="space-y-1.5">
            {summary.payload.keyPoints.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-gray-700"
              >
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-warm-400" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

export function SummaryPanel({
  summaries,
  artifacts,
  isGenerating = false,
}: SummaryPanelProps) {
  if (summaries.length === 0 && artifacts.length === 0 && !isGenerating) {
    return null;
  }

  if (isGenerating) {
    return null;
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

  // Check for MARKDOWN_SUMMARY artifact
  const markdownArtifact = artifacts.find(
    (a) =>
      a.type === "MARKDOWN_SUMMARY" && a.status === "READY" && a.storagePath,
  );

  return (
    <div className="space-y-4">
      {/* Render Markdown Summary if available */}
      {markdownArtifact && markdownArtifact.storagePath ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-warm-200/60">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-light">
              <svg
                className="h-4 w-4 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">AI Summary</h3>
          </div>
          <div className="streaming-prose">
            <Streamdown>{markdownArtifact.storagePath}</Streamdown>
          </div>
        </div>
      ) : (
        /* Fallback to structured summaries */
        Object.entries(groupedSummaries).map(([kind, kindSummaries]) => (
          <div
            key={kind}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-warm-200/60"
          >
            <div className="mb-4 flex items-center gap-2">
              <SectionIcon kind={kind} />
              <h3 className="text-sm font-semibold text-gray-900">
                {KIND_LABELS[kind] ?? kind}
              </h3>
            </div>
            <div className="space-y-4">
              {kindSummaries.map((summary) => (
                <div key={summary.id}>{renderSummaryContent(summary)}</div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
