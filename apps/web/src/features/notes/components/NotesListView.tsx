"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@ainotes/ui";
import { useNotes } from "../hooks/use-notes";
import { SearchBar } from "./SearchBar";
import { NoteCard } from "./NoteCard";
import { EmptyState } from "./EmptyState";
import type { Note } from "@ainotes/core";

function formatDateGroup(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor(
    (today.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function groupNotesByDate(notes: Note[]): [string, Note[]][] {
  const groups = new Map<string, Note[]>();

  for (const note of notes) {
    const date = new Date(note.updatedAt);
    const key = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).toISOString();

    const existing = groups.get(key);
    if (existing) {
      existing.push(note);
    } else {
      groups.set(key, [note]);
    }
  }

  return Array.from(groups.entries()).map(([key, groupNotes]) => [
    formatDateGroup(key),
    groupNotes,
  ]);
}

export function NotesListView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { notes, loading, error } = useNotes(
    searchQuery ? { q: searchQuery } : undefined,
  );

  const groupedNotes = useMemo(() => groupNotesByDate(notes), [notes]);

  const handleCreateNote = useCallback(() => {
    router.push("/note/new");
  }, [router]);

  const handlePin = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: true }),
      });
    } catch {
      // silently fail for now
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
    } catch {
      // silently fail for now
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">My Notes</h1>
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-2 rounded-xl btn-gradient-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            New Note
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl glass-card border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState onCreateNote={handleCreateNote} />
        ) : (
          <div className="space-y-6">
            {groupedNotes.map(([dateLabel, dateNotes]) => (
              <div key={dateLabel}>
                <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {dateLabel}
                </h2>
                <div className="divide-y divide-gray-100 glass-card rounded-2xl overflow-hidden">
                  {dateNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onPin={handlePin}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
