"use client";

import { useState, useCallback, useRef } from "react";
import type { GenerateResponse } from "@ainotes/api";
import type { ProcessingJobStatus } from "@ainotes/core";

export interface UseGenerateResult {
  generate: (kinds?: string[]) => Promise<void>;
  jobId: string | null;
  status: string | null;
  progressPct: number;
  message: string | null;
  cancel: () => Promise<void>;
  error: string | null;
}

export function useGenerate(noteId: string): UseGenerateResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connectToStream = useCallback(
    (id: string) => {
      cleanup();

      const es = new EventSource(`/api/jobs/${id}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("progress", (event: MessageEvent) => {
        const data = JSON.parse(event.data) as {
          progressPct: number;
          message: string | null;
          status: ProcessingJobStatus;
        };
        setProgressPct(data.progressPct);
        setMessage(data.message);
        setStatus(data.status);
      });

      es.addEventListener("done", (event: MessageEvent) => {
        const data = JSON.parse(event.data) as {
          status: ProcessingJobStatus;
        };
        setStatus(data.status);
        setProgressPct(100);
        cleanup();
      });

      es.onerror = () => {
        setError("Connection to job stream lost");
        cleanup();
      };
    },
    [cleanup],
  );

  const generate = useCallback(
    async (kinds?: string[]) => {
      setError(null);
      setProgressPct(0);
      setMessage(null);
      setStatus("QUEUED");

      try {
        const body: Record<string, unknown> = { noteId };
        if (kinds && kinds.length > 0) {
          body.kinds = kinds;
        }

        const response = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`Generate request failed: ${response.statusText}`);
        }

        const data = (await response.json()) as GenerateResponse;
        setJobId(data.jobId);
        connectToStream(data.jobId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start generation",
        );
        setStatus(null);
      }
    },
    [noteId, connectToStream],
  );

  const cancel = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Cancel request failed: ${response.statusText}`);
      }

      setStatus("CANCELLED");
      cleanup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    }
  }, [jobId, cleanup]);

  return {
    generate,
    jobId,
    status,
    progressPct,
    message,
    cancel,
    error,
  };
}
