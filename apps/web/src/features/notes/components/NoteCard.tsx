"use client";

import Link from "next/link";
import type { Note } from "@ainotes/core";

export interface NoteCardProps {
  note: Note;
  onPin?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function NoteCard({ note, onPin, onDelete }: NoteCardProps) {
  return (
    <Link
      href={`/note/${note.id}`}
      className="group flex items-center gap-4 rounded-xl px-4 py-3 transition-all hover:bg-warm-100"
    >
      {/* Document icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warm-200/60 text-warm-500 transition-colors group-hover:bg-warm-200">
        <svg
          className="h-5 w-5"
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
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-medium text-gray-900">
            {note.title || "Untitled"}
          </h3>
          {note.pinned && (
            <span className="text-amber-500" aria-label="Pinned" title="Pinned">
              <svg
                className="h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-warm-500">Me</p>
      </div>

      {/* Time */}
      <span className="shrink-0 text-sm tabular-nums text-warm-400">
        {formatTime(note.updatedAt)}
      </span>

      {/* Actions (visible on hover) */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onPin && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPin(note.id);
            }}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            className="rounded-md p-1.5 text-warm-400 hover:bg-warm-200 hover:text-warm-500"
          >
            <svg
              className="h-4 w-4"
              fill={note.pinned ? "currentColor" : "none"}
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth={note.pinned ? 0 : 1.5}
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(note.id);
            }}
            aria-label="Delete note"
            className="rounded-md p-1.5 text-warm-400 hover:bg-red-50 hover:text-red-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}
