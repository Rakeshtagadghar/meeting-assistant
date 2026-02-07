"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Note } from "@ainotes/core";

export interface UseNotesQuery {
  q?: string;
  tag?: string;
  pinned?: boolean;
}

export interface UseNotesResult {
  notes: Note[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function buildQueryString(query?: UseNotesQuery): string {
  if (!query) return "";

  const params = new URLSearchParams();

  if (query.q) params.set("q", query.q);
  if (query.tag) params.set("tag", query.tag);
  if (query.pinned !== undefined) params.set("pinned", String(query.pinned));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useNotes(query?: UseNotesQuery): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchNotes = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const qs = buildQueryString(query);
      const response = await fetch(`/api/notes${qs}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }

      const data = await response.json();
      setNotes(data.notes ?? data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }, [query?.q, query?.tag, query?.pinned]);

  useEffect(() => {
    fetchNotes();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchNotes]);

  const refetch = useCallback(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, loading, error, refetch };
}
