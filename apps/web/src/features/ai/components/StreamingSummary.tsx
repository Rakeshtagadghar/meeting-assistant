"use client";

import { useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import type { StreamingStatus } from "../hooks/use-streaming-summary";

export interface StreamingSummaryProps {
  streamedText: string;
  status: StreamingStatus;
  error: string | null;
  onCancel: () => void;
}

export function StreamingSummary({
  streamedText,
  status,
  error,
  onCancel,
}: StreamingSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as content grows
  useEffect(() => {
    if (containerRef.current && status === "streaming") {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [streamedText, status]);

  if (status === "idle") return null;

  const isStreaming = status === "streaming" || status === "connecting";

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-warm-200/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-warm-200/60 px-6 py-3">
        <div className="flex items-center gap-2.5">
          {/* Sparkle icon */}
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
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            AI Summary
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-medium text-accent">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Generating...
            </span>
          )}
          {status === "done" && (
            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              Complete
            </span>
          )}
        </div>
        {isStreaming && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-warm-500 transition-colors hover:bg-warm-100 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Streaming content area */}
      <div
        ref={containerRef}
        className="max-h-[600px] overflow-y-auto px-6 py-5"
      >
        {/* Thinking indicator */}
        {status === "connecting" && !streamedText && (
          <div className="flex items-center gap-3 py-4">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-2 w-2 animate-bounce rounded-full bg-accent"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-sm text-warm-400">
              Analyzing your notes...
            </span>
          </div>
        )}

        {/* Rendered markdown content using streamdown */}
        {streamedText && (
          <div className="streaming-prose">
            <Streamdown>{streamedText}</Streamdown>
            {/* Blinking cursor while streaming */}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-accent align-text-bottom" />
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-6 py-3">
          <p className="text-sm text-red-700">
            <span className="font-medium">Error:</span> {error}
          </p>
        </div>
      )}

      {/* Completion footer */}
      {status === "done" && (
        <div className="border-t border-warm-200/60 bg-warm-50 px-6 py-3">
          <p className="flex items-center gap-1.5 text-xs text-warm-500">
            <svg
              className="h-3.5 w-3.5 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            Summary generated and saved to your note
          </p>
        </div>
      )}

      {/* Cancelled state */}
      {status === "cancelled" && (
        <div className="border-t border-warm-200/60 bg-warm-50 px-6 py-3">
          <p className="text-xs text-warm-400">Generation cancelled</p>
        </div>
      )}
    </div>
  );
}
