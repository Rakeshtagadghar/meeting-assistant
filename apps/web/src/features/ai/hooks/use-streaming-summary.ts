"use client";

import { useState, useCallback, useRef } from "react";

export type StreamingStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "done"
  | "error"
  | "cancelled";

export interface UseStreamingSummaryResult {
  streamedText: string;
  status: StreamingStatus;
  error: string | null;
  generatedTitle: string | null;
  generate: () => Promise<void>;
  cancel: () => void;
  /** Reset streaming state back to idle (e.g. after SummaryPanel takes over) */
  reset: () => void;
}

export function useStreamingSummary(noteId: string): UseStreamingSummaryResult {
  const [streamedText, setStreamedText] = useState("");
  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus("cancelled");
  }, []);

  const generate = useCallback(async () => {
    // Reset state
    setStreamedText("");
    setError(null);
    setStatus("connecting");
    setGeneratedTitle(null);

    // Create abort controller
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/ai/summarize-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
          (errBody as { error?: { message?: string } } | null)?.error
            ?.message ?? `Request failed: ${response.statusText}`,
        );
      }

      setStatus("streaming");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer
        const parts = buffer.split("\n\n");
        // Keep incomplete event in buffer
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let data = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              data = line.slice(6);
            }
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (eventType === "token") {
              const token = (parsed as { token: string }).token;
              // Filter out GENERATED_TITLE line from display
              setStreamedText((prev) => {
                const newText = prev + token;
                // Remove GENERATED_TITLE line if present
                return newText.replace(/^GENERATED_TITLE:\s*.+?\n/m, "");
              });
            } else if (eventType === "titleUpdate") {
              setGeneratedTitle((parsed as { title: string }).title);
            } else if (eventType === "done") {
              setStatus("done");
            } else if (eventType === "error") {
              setError((parsed as { message: string }).message);
              setStatus("error");
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      }

      // If we finished reading without a done event, mark as done
      setStatus((prev) => (prev === "streaming" ? "done" : prev));
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
      } else {
        setError(err instanceof Error ? err.message : "Streaming failed");
        setStatus("error");
      }
    }
  }, [noteId]);

  const reset = useCallback(() => {
    setStreamedText("");
    setStatus("idle");
    setError(null);
    setGeneratedTitle(null);
  }, []);

  return {
    streamedText,
    status,
    error,
    generatedTitle,
    generate,
    cancel,
    reset,
  };
}
