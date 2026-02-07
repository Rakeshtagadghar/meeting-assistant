"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface AutosaveData {
  title?: string;
  contentRich?: unknown;
  contentPlain?: string;
  tags?: string[];
  pinned?: boolean;
}

export interface UseAutosaveResult {
  save: (data: AutosaveData) => void;
  saving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

const DEBOUNCE_MS = 1000;

export function useAutosave(noteId: string): UseAutosaveResult {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const performSave = useCallback(
    async (data: AutosaveData) => {
      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(
            (errorBody as { error?: { message?: string } }).error?.message ??
              "Failed to save note",
          );
        }

        setLastSaved(new Date());
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to save note");
      } finally {
        setSaving(false);
      }
    },
    [noteId],
  );

  const save = useCallback(
    (data: AutosaveData) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        void performSave(data);
      }, DEBOUNCE_MS);
    },
    [performSave],
  );

  return { save, saving, lastSaved, error };
}
