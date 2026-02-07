"use client";

import Link from "next/link";
import type { Note } from "@ainotes/core";
import { Card, Badge, Button } from "@ainotes/ui";

export interface NoteCardProps {
  note: Note;
  onPin?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const typeVariantMap: Record<string, "info" | "success" | "default"> = {
  MEETING: "info",
  FREEFORM: "success",
};

export function NoteCard({ note, onPin, onDelete }: NoteCardProps) {
  return (
    <Link href={`/note/${note.id}`} className="block">
      <Card hoverable className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-gray-900">
                {note.title}
              </h3>
              {note.pinned && (
                <span
                  className="text-amber-500"
                  aria-label="Pinned"
                  title="Pinned"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {formatDate(note.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onPin && (
              <Button
                variant="secondary"
                className="h-8 w-8 !p-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPin(note.id);
                }}
                aria-label={note.pinned ? "Unpin note" : "Pin note"}
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
              </Button>
            )}
            {onDelete && (
              <Button
                variant="secondary"
                className="h-8 w-8 !p-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(note.id);
                }}
                aria-label="Delete note"
              >
                <svg
                  className="h-4 w-4 text-red-500"
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
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={typeVariantMap[note.type] ?? "default"}>
            {note.type}
          </Badge>
          {note.tags.map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>
      </Card>
    </Link>
  );
}
