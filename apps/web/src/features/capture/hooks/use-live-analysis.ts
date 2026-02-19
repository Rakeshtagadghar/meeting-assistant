"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptWindowState } from "../components/TranscriptFooter";
import type { TranscriptSessionChunk } from "./use-transcript-session";
import {
  LIVE_ANALYSIS_HEURISTICS_KEY,
  LIVE_ANALYSIS_SETTINGS_EVENT,
} from "@/features/settings/live-analysis-settings";
import type {
  LiveAnalysisCallSummary,
  LiveAnalysisCoachPayload,
  LiveAnalysisInsight,
  LiveAnalysisMetrics,
  LiveAnalysisMode,
  LiveAnalysisResponse,
  LiveAnalysisStreamStatus,
} from "../live-analysis/types";

const ANALYSIS_INTERVAL_MS = 15_000;
const DEFAULT_CONTEXT_WINDOW_MS = 30_000;
const WARMUP_CONTEXT_WINDOW_MS = 60_000;
const DEFAULT_MAX_DELTA_UTTERANCES = 12;
const HIGH_SPEECH_MAX_DELTA_UTTERANCES = 8;
const HIGH_SPEECH_WORDS_THRESHOLD = 120;
const RATE_LIMIT_DEGRADE_MS = 120_000;
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
  const [useHeuristics, setUseHeuristics] = useState(true);
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
  const degradeToLightUntilRef = useRef(0);
  const inFlightRef = useRef<{ light: boolean; deep: boolean }>({
    light: false,
    deep: false,
  });
  const enabledRef = useRef(enabled);
  const requestVersionRef = useRef(0);
  const warmupPendingRef = useRef(false);

  const sessionActive = useMemo(() => {
    return windowState === "listening" || windowState === "paused";
  }, [windowState]);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = globalThis.localStorage.getItem(
        LIVE_ANALYSIS_HEURISTICS_KEY,
      );
      setUseHeuristics(stored !== "false");
    };

    syncFromStorage();
    globalThis.addEventListener("storage", syncFromStorage);
    globalThis.addEventListener(LIVE_ANALYSIS_SETTINGS_EVENT, syncFromStorage);
    return () => {
      globalThis.removeEventListener("storage", syncFromStorage);
      globalThis.removeEventListener(
        LIVE_ANALYSIS_SETTINGS_EVENT,
        syncFromStorage,
      );
    };
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const sendRequest = useCallback(
    async (
      mode: LiveAnalysisMode,
      contextWindowMs = DEFAULT_CONTEXT_WINDOW_MS,
    ) => {
      if (!sessionId || !enabled) return;
      if (!sessionActive && windowState !== "processing") return;
      if (inFlightRef.current[mode]) return;
      const requestVersion = requestVersionRef.current;

      inFlightRef.current[mode] = true;
      if (streamStatus === "idle" || streamStatus === "error") {
        setStreamStatus("connecting");
      }

      const startedAt = performance.now();
      try {
        const now = Date.now();
        const effectiveMode: LiveAnalysisMode =
          now < degradeToLightUntilRef.current ? "light" : mode;
        const latestChunkTs = finalChunks[finalChunks.length - 1]?.tEndMs ?? 0;
        const windowStartTs = latestChunkTs - contextWindowMs;
        const recentChunks = finalChunks.filter(
          (chunk) => chunk.tEndMs >= windowStartTs,
        );
        const recentWords = recentChunks.reduce(
          (sum, chunk) => sum + chunk.text.trim().split(/\s+/).length,
          0,
        );
        const maxDeltaUtterances =
          recentWords > HIGH_SPEECH_WORDS_THRESHOLD
            ? HIGH_SPEECH_MAX_DELTA_UTTERANCES
            : DEFAULT_MAX_DELTA_UTTERANCES;
        const chunksForRequest = (
          recentChunks.length > 0 ? recentChunks : finalChunks
        ).slice(-maxDeltaUtterances);

        const response = await fetch(
          `/api/meetings/${sessionId}/live-analysis`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: true,
              mode: effectiveMode,
              privacyMode,
              useHeuristics,
              sensitivity,
              coachingAggressiveness,
              chunks: chunksForRequest.map((chunk) => ({
                id: chunk.id,
                sequence: chunk.sequence,
                tStartMs: chunk.tStartMs,
                tEndMs: chunk.tEndMs,
                speaker: chunk.speaker,
                speakerRole: chunk.speakerRole,
                audioSource: chunk.audioSource,
                prosodyEnergy: chunk.prosodyEnergy,
                prosodyPauseRatio: chunk.prosodyPauseRatio,
                prosodyVoicedMs: chunk.prosodyVoicedMs,
                prosodySnrDb: chunk.prosodySnrDb,
                prosodyQualityPass: chunk.prosodyQualityPass,
                prosodyToneWeightsEnabled: chunk.prosodyToneWeightsEnabled,
                prosodyConfidencePenalty: chunk.prosodyConfidencePenalty,
                prosodyClientEnergy: chunk.prosodyClientEnergy,
                prosodyClientStress: chunk.prosodyClientStress,
                prosodyClientCertainty: chunk.prosodyClientCertainty,
                text: chunk.text,
                confidence: chunk.confidence,
              })),
              partialText,
            }),
          },
        );

        if (!response.ok) {
          if (response.status === 429) {
            degradeToLightUntilRef.current = Date.now() + RATE_LIMIT_DEGRADE_MS;
          }
          throw new Error(`Live analysis request failed (${response.status})`);
        }

        const data = (await response.json()) as LiveAnalysisResponse;
        if (
          requestVersion !== requestVersionRef.current ||
          !enabledRef.current
        ) {
          return;
        }
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
        if (
          requestVersion !== requestVersionRef.current ||
          !enabledRef.current
        ) {
          return;
        }
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
      useHeuristics,
      sensitivity,
      coachingAggressiveness,
      finalChunks,
      partialText,
    ],
  );

  useEffect(() => {
    if (!enabled) {
      requestVersionRef.current += 1;
      warmupPendingRef.current = false;
      setStreamStatus("idle");
      setMetrics(null);
      setCoach(null);
      setSummary(null);
      setInsights([]);
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

    const contextWindowMs = warmupPendingRef.current
      ? WARMUP_CONTEXT_WINDOW_MS
      : DEFAULT_CONTEXT_WINDOW_MS;
    warmupPendingRef.current = false;

    void sendRequest("deep", contextWindowMs);
    const deepTimer = setInterval(() => {
      void sendRequest("deep");
    }, ANALYSIS_INTERVAL_MS);

    return () => {
      clearInterval(deepTimer);
    };
  }, [enabled, sessionId, sessionActive, sendRequest, windowState]);

  useEffect(() => {
    if (enabled) {
      warmupPendingRef.current = true;
      return;
    }
    requestVersionRef.current += 1;
    inFlightRef.current.light = false;
    inFlightRef.current.deep = false;
  }, [enabled]);

  useEffect(() => {
    if (windowState === "idle") {
      requestVersionRef.current += 1;
      setStreamStatus("idle");
      failureCountRef.current = 0;
      degradeToLightUntilRef.current = 0;
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
    requestVersionRef.current += 1;
    warmupPendingRef.current = enabled;
    failureCountRef.current = 0;
    degradeToLightUntilRef.current = 0;
    inFlightRef.current.light = false;
    inFlightRef.current.deep = false;
  }, [enabled, sessionId]);

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
