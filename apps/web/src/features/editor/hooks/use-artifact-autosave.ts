"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseArtifactAutosaveResult {
  save: (content: string) => void;
  saving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

const DEBOUNCE_MS = 1500; // Slightly longer debounce for summary edits

export function useArtifactAutosave(noteId: string): UseArtifactAutosaveResult {
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
    async (content: string) => {
      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/notes/${noteId}/artifacts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to save summary: ${response.statusText}`);
        }

        setLastSaved(new Date());
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to save summary");
      } finally {
        setSaving(false);
      }
    },
    [noteId],
  );

  const save = useCallback(
    (content: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        void performSave(content);
      }, DEBOUNCE_MS);
    },
    [performSave],
  );

  return { save, saving, lastSaved, error };
}
