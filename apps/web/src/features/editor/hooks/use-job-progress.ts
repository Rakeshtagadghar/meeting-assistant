"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface JobProgress {
  status: "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progressPct: number;
  message: string;
  error?: string;
  jobId?: string;
}

interface UseJobProgressReturn extends JobProgress {
  startTracking: (jobId: string) => void;
  cancelJob: () => Promise<void>;
  reset: () => void;
}

export function useJobProgress(): UseJobProgressReturn {
  const [state, setState] = useState<JobProgress>({
    status: "IDLE",
    progressPct: 0,
    message: "",
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState({
      status: "IDLE",
      progressPct: 0,
      message: "",
    });
  }, []);

  const startTracking = useCallback((jobId: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setState({
      status: "QUEUED",
      progressPct: 0,
      message: "Starting...",
      jobId,
    });

    const url = `/api/jobs/${jobId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // Native EventSource onmessage is not used because we use custom events
    // es.onmessage = ...

    es.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          status: "RUNNING",
          progressPct: data.progressPct,
          message: data.message,
          jobId,
        }));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error parsing progress event", e);
      }
    });

    es.addEventListener("done", (event) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _data = JSON.parse(event.data); // Keep parsing to ensure valid JSON, but ignore result
        setState((prev) => ({
          ...prev,
          status: "COMPLETED",
          progressPct: 100,
          message: "Completed",
          jobId,
        }));
        es.close();
        eventSourceRef.current = null;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error parsing done event", e);
      }
    });

    es.addEventListener("error", (event) => {
      // This captures network errors AND explicit "error" events from server
      // To distinguish, we check if event has data (our explicit error)
      // or if it's a generic Event (network error)
      if (event instanceof MessageEvent) {
        try {
          const data = JSON.parse(event.data);
          setState((prev) => ({
            ...prev,
            status: "FAILED",
            error: data.message || "Unknown error",
            jobId,
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            status: "FAILED",
            error: "Connection failed",
            jobId,
          }));
        }
      } else {
        // Browser network error or connection closed
        // Don't auto-fail immediately on simple connection jitter, but for MVP we treat as error
        // eslint-disable-next-line no-console
        console.error("SSE Connection error", event);
        // Verify if job is actually done or failed by fetch?
        // For now, close and mark failed
        es.close();
        eventSourceRef.current = null;
        setState((prev) => ({
          ...prev,
          status: "FAILED",
          error: "Connection lost",
        }));
      }
    });
  }, []);

  const cancelJob = useCallback(async () => {
    const jobId = state.jobId;
    if (!jobId) return;

    try {
      setState((prev) => ({ ...prev, message: "Cancelling..." }));
      await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });

      setState((prev) => ({
        ...prev,
        status: "CANCELLED",
        message: "Job cancelled",
      }));

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error cancelling job", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to cancel job",
      }));
    }
  }, [state.jobId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    cancelJob,
    reset,
  };
}
