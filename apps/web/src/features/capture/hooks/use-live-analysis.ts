"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptWindowState } from "../components/TranscriptFooter";
import type { TranscriptSessionChunk } from "./use-transcript-session";
import type {
  LiveAnalysisCallSummary,
  LiveAnalysisCoachPayload,
  LiveAnalysisInsight,
  LiveAnalysisMetrics,
  LiveAnalysisMode,
  LiveAnalysisResponse,
  LiveAnalysisStreamStatus,
} from "../live-analysis/types";

const LIGHT_METRICS_INTERVAL_MS = 2_000;
const DEEP_INSIGHTS_INTERVAL_MS = 5_000;
const MAX_FAILURES_BEFORE_ERROR = 4;

interface UseLiveAnalysisOptions {
  sessionId: string | null;
  windowState: TranscriptWindowState;
  finalChunks: TranscriptSessionChunk[];
  partialText: string | null;
}

export interface UseLiveAnalysisResult {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  privacyMode: boolean;
  setPrivacyMode: (value: boolean) => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
  coachingAggressiveness: number;
  setCoachingAggressiveness: (value: number) => void;
  streamStatus: LiveAnalysisStreamStatus;
  latencyMs: number | null;
  metrics: LiveAnalysisMetrics | null;
  coach: LiveAnalysisCoachPayload | null;
  summary: LiveAnalysisCallSummary | null;
  insights: LiveAnalysisInsight[];
  usedSuggestionIds: Set<string>;
  suggestionRatings: Record<string, "up" | "down">;
  copySuggestion: (text: string) => Promise<boolean>;
  markSuggestionUsed: (id: string) => void;
  rateSuggestion: (id: string, rating: "up" | "down") => void;
}

function mergeInsights(
  existing: LiveAnalysisInsight[],
  incoming: LiveAnalysisInsight[],
): LiveAnalysisInsight[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((item) => [item.insightId, item]));
  for (const insight of incoming) {
    byId.set(insight.insightId, insight);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, 40);
}

export function useLiveAnalysis({
  sessionId,
  windowState,
  finalChunks,
  partialText,
}: UseLiveAnalysisOptions): UseLiveAnalysisResult {
  const [enabled, setEnabled] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [coachingAggressiveness, setCoachingAggressiveness] = useState(40);
  const [streamStatus, setStreamStatus] =
    useState<LiveAnalysisStreamStatus>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<LiveAnalysisMetrics | null>(null);
  const [coach, setCoach] = useState<LiveAnalysisCoachPayload | null>(null);
  const [summary, setSummary] = useState<LiveAnalysisCallSummary | null>(null);
  const [insights, setInsights] = useState<LiveAnalysisInsight[]>([]);
  const [usedSuggestionIds, setUsedSuggestionIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [suggestionRatings, setSuggestionRatings] = useState<
    Record<string, "up" | "down">
  >({});

  const failureCountRef = useRef(0);
  const inFlightRef = useRef<{ light: boolean; deep: boolean }>({
    light: false,
    deep: false,
  });

  const sessionActive = useMemo(() => {
    return windowState === "listening" || windowState === "paused";
  }, [windowState]);

  const sendRequest = useCallback(
    async (mode: LiveAnalysisMode) => {
      if (!sessionId || !enabled) return;
      if (!sessionActive && windowState !== "processing") return;
      if (inFlightRef.current[mode]) return;

      inFlightRef.current[mode] = true;
      if (streamStatus === "idle" || streamStatus === "error") {
        setStreamStatus("connecting");
      }

      const startedAt = performance.now();
      try {
        const response = await fetch(
          `/api/meetings/${sessionId}/live-analysis`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: true,
              mode,
              privacyMode,
              sensitivity,
              coachingAggressiveness,
              chunks: finalChunks.slice(-120).map((chunk) => ({
                id: chunk.id,
                sequence: chunk.sequence,
                tStartMs: chunk.tStartMs,
                tEndMs: chunk.tEndMs,
                speaker: chunk.speaker,
                text: chunk.text,
                confidence: chunk.confidence,
              })),
              partialText,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`Live analysis request failed (${response.status})`);
        }

        const data = (await response.json()) as LiveAnalysisResponse;
        if (data.metrics) setMetrics(data.metrics);
        if (data.coach) setCoach(data.coach);
        if (data.summary) setSummary(data.summary);
        if (data.insights.length > 0) {
          setInsights((current) => mergeInsights(current, data.insights));
        }
        failureCountRef.current = 0;
        setStreamStatus("live");
        setLatencyMs(Math.round(performance.now() - startedAt));
      } catch {
        failureCountRef.current += 1;
        setStreamStatus(
          failureCountRef.current > MAX_FAILURES_BEFORE_ERROR
            ? "error"
            : "reconnecting",
        );
      } finally {
        inFlightRef.current[mode] = false;
      }
    },
    [
      sessionId,
      enabled,
      sessionActive,
      windowState,
      streamStatus,
      privacyMode,
      sensitivity,
      coachingAggressiveness,
      finalChunks,
      partialText,
    ],
  );

  useEffect(() => {
    if (!enabled) {
      setStreamStatus("idle");
      setLatencyMs(null);
      return;
    }
    if (!sessionId) {
      setStreamStatus("error");
      return;
    }
    if (!sessionActive && windowState !== "processing") {
      return;
    }

    void sendRequest("deep");
    void sendRequest("light");

    const lightTimer = setInterval(() => {
      void sendRequest("light");
    }, LIGHT_METRICS_INTERVAL_MS);

    const deepTimer = setInterval(() => {
      void sendRequest("deep");
    }, DEEP_INSIGHTS_INTERVAL_MS);

    return () => {
      clearInterval(lightTimer);
      clearInterval(deepTimer);
    };
  }, [enabled, sessionId, sessionActive, sendRequest, windowState]);

  useEffect(() => {
    if (windowState === "idle") {
      setStreamStatus("idle");
      failureCountRef.current = 0;
      inFlightRef.current.light = false;
      inFlightRef.current.deep = false;
    }
  }, [windowState]);

  useEffect(() => {
    setMetrics(null);
    setCoach(null);
    setSummary(null);
    setInsights([]);
    setUsedSuggestionIds(new Set<string>());
    setSuggestionRatings({});
    setLatencyMs(null);
    failureCountRef.current = 0;
    inFlightRef.current.light = false;
    inFlightRef.current.deep = false;
  }, [sessionId]);

  const copySuggestion = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const markSuggestionUsed = useCallback((id: string) => {
    setUsedSuggestionIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const rateSuggestion = useCallback((id: string, rating: "up" | "down") => {
    setSuggestionRatings((current) => ({ ...current, [id]: rating }));
  }, []);

  return {
    enabled,
    setEnabled,
    privacyMode,
    setPrivacyMode,
    sensitivity,
    setSensitivity,
    coachingAggressiveness,
    setCoachingAggressiveness,
    streamStatus,
    latencyMs,
    metrics,
    coach,
    summary,
    insights,
    usedSuggestionIds,
    suggestionRatings,
    copySuggestion,
    markSuggestionUsed,
    rateSuggestion,
  };
}
