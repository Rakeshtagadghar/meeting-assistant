"use client";

import { Streamdown } from "streamdown";
import type { AISummary, NoteArtifact } from "@ainotes/core";
import { useEffect, useState, useRef } from "react";
import { useArtifactAutosave } from "../hooks/use-artifact-autosave";
import { useHistory } from "../../../hooks/use-history";

// ... helper functions ...

// ... helper functions ...

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

export interface SummaryPanelProps {
  noteId: string;
  summaries: AISummary[];
  artifacts: NoteArtifact[];
  isGenerating?: boolean;
  dictation?: {
    isListening: boolean;
    isProcessing?: boolean;
    transcript: string;
    partialText: string;
    toggleRecording: () => void;
  };
  transcriptContent?: string;
  onTranscriptChange?: (value: string) => void;
}

export function SummaryPanel({
  noteId,
  summaries,
  artifacts,
  isGenerating = false,
  dictation,
  transcriptContent = "",
  onTranscriptChange,
}: SummaryPanelProps) {
  /* State */
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">(() => {
    // If generation is active, stay on preview/summary tab? Or respect user state?
    // Usually if generating, we want to see it streaming (summary tab).
    if (isGenerating) return "summary";

    // If we have a summary (or artifact), default to summary tab.
    // We check artifacts specifically for MARKDOWN_SUMMARY as that's the primary display.
    const hasSummary =
      summaries.length > 0 ||
      artifacts.some(
        (a) => a.type === "MARKDOWN_SUMMARY" && a.status === "READY",
      );
    const hasTranscript = transcriptContent.trim().length > 0;

    // If no summary but we have transcript content, default to transcript tab.
    if (!hasSummary && hasTranscript) {
      return "transcript";
    }
    // Otherwise default to summary (shows empty state if both missing).
    return "summary";
  });

  const [isEditing, setIsEditing] = useState(false);
  const prevIsGenerating = useRef(isGenerating);

  // Switch to summary tab after generation completes
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating) {
      setActiveTab("summary");
      setIsEditing(false); // Reset to preview mode
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating]);

  // Check for MARKDOWN_SUMMARY artifact
  const markdownArtifact = artifacts.find(
    (a) =>
      a.type === "MARKDOWN_SUMMARY" && a.status === "READY" && a.storagePath,
  );

  const initialContent = markdownArtifact?.storagePath || "";

  const {
    state: content,
    replace,
    snapshot,
    handleKeyDown,
    set: setHistory,
  } = useHistory(initialContent);

  const { save, saving, lastSaved } = useArtifactAutosave(noteId);

  // Sync content when artifact changes
  useEffect(() => {
    if (
      markdownArtifact?.storagePath &&
      markdownArtifact.storagePath !== content
    ) {
      setHistory(markdownArtifact.storagePath);
    }
  }, [markdownArtifact?.storagePath, setHistory]);

  // Sync tab when dictation starts
  useEffect(() => {
    if (dictation?.isListening) {
      setActiveTab("transcript");
    }
  }, [dictation?.isListening]);

  // Auto-switch to transcript if summary is empty and transcript becomes available (e.g. initial load)
  const hasAttemptedAutoSwitch = useRef(false);
  useEffect(() => {
    if (hasAttemptedAutoSwitch.current) return;

    const hasSummary =
      summaries.length > 0 ||
      artifacts.some(
        (a) => a.type === "MARKDOWN_SUMMARY" && a.status === "READY",
      );

    if (!hasSummary && transcriptContent.trim().length > 0) {
      setActiveTab("transcript");
      hasAttemptedAutoSwitch.current = true;
    }
  }, [transcriptContent, summaries, artifacts]);

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    replace(newVal);
    save(newVal);
  };

  const handleBlur = () => {
    snapshot();
  };

  const handleTranscriptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    onTranscriptChange?.(e.target.value);
  };

  const handleDictateClick = () => {
    if (dictation) {
      if (!dictation.isListening) {
        setActiveTab("transcript");
      }
      dictation.toggleRecording();
    }
  };

  if (isGenerating) {
    return null;
  }

  /* Fallback to structured summaries */
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

  const showMarkdownView =
    (markdownArtifact && markdownArtifact.storagePath) || content;
  const hasContent =
    showMarkdownView || Object.keys(groupedSummaries).length > 0;

  return (
    <div>
      <div className="group relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-warm-200/60 transition-shadow focus-within:ring-warm-300 hover:shadow-md">
        {/* Header with Tabs */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("summary")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "summary"
                    ? "bg-warm-100 text-gray-900"
                    : "text-warm-500 hover:bg-warm-50 hover:text-gray-700"
                }`}
              >
                <svg
                  className={`h-4 w-4 ${
                    activeTab === "summary" ? "text-accent" : "text-current"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                  />
                </svg>
                AI Summary
              </button>
              <button
                onClick={() => setActiveTab("transcript")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "transcript"
                    ? "bg-warm-100 text-gray-900"
                    : "text-warm-500 hover:bg-warm-50 hover:text-gray-700"
                }`}
              >
                <svg
                  className={`h-4 w-4 ${
                    activeTab === "transcript" ? "text-accent" : "text-current"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
                Transcript
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Acton Buttons based on Tab */}
            {activeTab === "transcript" && dictation && (
              <button
                onClick={handleDictateClick}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  dictation.isListening
                    ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                    : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                }`}
              >
                {dictation.isListening ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                    </span>
                    Stop
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                      />
                    </svg>
                    Dictate
                  </>
                )}
              </button>
            )}

            {activeTab === "summary" && hasContent && (
              <div className="flex rounded-lg bg-warm-100/50 p-0.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    !isEditing
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-warm-500 hover:text-gray-700"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    isEditing
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-warm-500 hover:text-gray-700"
                  }`}
                >
                  Edit
                </button>
              </div>
            )}

            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-xs text-warm-400">
              {saving ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  Saving...
                </span>
              ) : lastSaved ? (
                <span>Saved</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content Views */}
        {activeTab === "summary" && (
          <>
            {hasContent ? (
              showMarkdownView ? (
                <>
                  {!isEditing && (
                    <div className="streaming-prose">
                      <Streamdown>{content}</Streamdown>
                    </div>
                  )}
                  {isEditing && (
                    <textarea
                      value={content}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      onKeyDown={handleKeyDown}
                      placeholder="Summary content..."
                      className="min-h-[600px] w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed text-gray-700 placeholder:text-warm-300 focus:outline-none focus:ring-0"
                      spellCheck={false}
                    />
                  )}
                </>
              ) : (
                /* Fallback to structured summaries if no markdown */
                <div className="space-y-6">
                  {Object.entries(groupedSummaries).map(
                    ([kind, kindSummaries]) => (
                      <div key={kind}>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warm-500">
                          <SectionIcon kind={kind} />
                          {KIND_LABELS[kind] ?? kind}
                        </div>
                        <div className="space-y-4">
                          {kindSummaries.map((summary) => (
                            <div key={summary.id}>
                              {renderSummaryContent(summary)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warm-100">
                  <svg
                    className="h-6 w-6 text-warm-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 text-base font-semibold text-gray-900">
                  Ready to take notes?
                </h3>
                <p className="mb-6 max-w-sm text-sm text-warm-500">
                  Dictate your meeting notes or type a summary to get started.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDictateClick}
                    className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                      />
                    </svg>
                    Start Dictation
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50"
                  >
                    Type Summary
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "transcript" && (
          <div className="relative min-h-[150px]">
            <textarea
              value={transcriptContent}
              onChange={handleTranscriptChange}
              placeholder="Start typing or dictate to generate a transcript..."
              className="h-full min-h-[300px] w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed text-gray-700 placeholder:text-warm-300 focus:outline-none focus:ring-0"
              spellCheck={false}
            />
            {dictation && (
              <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-2">
                {dictation.isProcessing && (
                  <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 ring-1 ring-indigo-200 transition-all animate-in fade-in slide-in-from-bottom-2">
                    <svg
                      className="h-3 w-3 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </div>
                )}
                {dictation.isListening && (
                  <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 ring-1 ring-red-200">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                    </span>
                    Recording...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
