"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Note, AISummary, NoteArtifact } from "@ainotes/core";
import type { GetNoteResponse } from "@ainotes/api";

export interface UseNoteResult {
  note: Note | null;
  summaries: AISummary[];
  artifacts: NoteArtifact[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNote(noteId: string): UseNoteResult {
  const [note, setNote] = useState<Note | null>(null);
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [artifacts, setArtifacts] = useState<NoteArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const fetchNote = useCallback(async () => {
    // Only set loading on initial fetch, not on refetch
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/notes/${noteId}`);

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
          (errorBody as { error?: { message?: string } }).error?.message ??
            "Failed to fetch note",
        );
      }

      const data = (await response.json()) as GetNoteResponse;
      setNote(data.note);
      setSummaries(data.summaries);
      setArtifacts(data.artifacts);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch note");
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    initialLoadDone.current = false;
    void fetchNote();
  }, [fetchNote]);

  return { note, summaries, artifacts, loading, error, refetch: fetchNote };
}
