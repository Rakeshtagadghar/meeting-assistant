"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@ainotes/ui";
import { useNotes } from "../hooks/use-notes";
import { SearchBar } from "./SearchBar";
import { NoteCard } from "./NoteCard";
import { EmptyState } from "./EmptyState";

export function NotesListView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { notes, loading, error } = useNotes(
    searchQuery ? { q: searchQuery } : undefined,
  );

  const handleCreateNote = useCallback(() => {
    router.push("/note/new");
  }, [router]);

  const handlePin = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notes/${id}/pin`, { method: "PATCH" });
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
        <Button onClick={handleCreateNote}>New Note</Button>
      </div>

      <div className="mb-6">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState onCreateNote={handleCreateNote} />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onPin={handlePin}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
