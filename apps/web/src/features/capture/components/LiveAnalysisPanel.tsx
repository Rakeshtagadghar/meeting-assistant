"use client";

import { useState } from "react";
import { Button } from "@ainotes/ui";
import {
  LIVE_ANALYSIS_TOPICS,
  type LiveAnalysisCallSummary,
  type LiveAnalysisCoachDoDont,
  type LiveAnalysisCoachQuestion,
  type LiveAnalysisCoachSuggestion,
  type LiveAnalysisMetrics,
  type LiveAnalysisTopic,
} from "../live-analysis/types";

interface LiveAnalysisPanelProps {
  isSessionCompleted: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  privacyMode: boolean;
  setPrivacyMode: (value: boolean) => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
  coachingAggressiveness: number;
  setCoachingAggressiveness: (value: number) => void;
  streamStatus: "idle" | "connecting" | "live" | "reconnecting" | "error";
  latencyMs: number | null;
  metrics: LiveAnalysisMetrics | null;
  summary: LiveAnalysisCallSummary | null;
  coach: {
    nextBestSay: LiveAnalysisCoachSuggestion[];
    nextQuestions: LiveAnalysisCoachQuestion[];
    doDont: LiveAnalysisCoachDoDont[];
  } | null;
  insights: Array<{
    insightId: string;
    timestampMs: number;
    type: string;
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
    confidence: number;
    evidenceSnippets: Array<{ text: string }>;
  }>;
  usedSuggestionIds: Set<string>;
  suggestionRatings: Record<string, "up" | "down">;
  onCopySuggestion: (text: string) => Promise<boolean>;
  onMarkSuggestionUsed: (id: string) => void;
  onRateSuggestion: (id: string, rating: "up" | "down") => void;
}

function topicLabel(topic: LiveAnalysisTopic): string {
  switch (topic) {
    case "needProblem":
      return "Need / Problem";
    case "budget":
      return "Budget";
    case "timeline":
      return "Timeline";
    case "decisionMaker":
      return "Decision Maker";
    case "alternativesCompetitors":
      return "Alternatives / Competitors";
    case "technicalFit":
      return "Technical Fit";
    case "securityCompliance":
      return "Security / Compliance";
    case "procurement":
      return "Procurement";
    case "nextSteps":
      return "Next Steps";
  }
}

function statusTone(status: LiveAnalysisPanelProps["streamStatus"]): string {
  switch (status) {
    case "live":
      return "bg-green-100 text-green-700";
    case "connecting":
      return "bg-indigo-100 text-indigo-700";
    case "reconnecting":
      return "bg-amber-100 text-amber-700";
    case "error":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function metricColor(value: number, middle = 0.5): string {
  if (value >= middle + 0.15) return "text-green-700";
  if (value <= middle - 0.15) return "text-red-700";
  return "text-amber-700";
}

function riskLabel(risk?: string): string {
  switch (risk) {
    case "priceObjection":
      return "Price objection";
    case "timingObjection":
      return "Timing objection";
    case "trustConcern":
      return "Trust concern";
    case "featureGap":
      return "Feature gap";
    case "securityConcern":
      return "Security concern";
    case "integrationConcern":
      return "Integration concern";
    case "competitorMention":
      return "Competitor mention";
    case "confusion":
      return "Client confusion";
    case "frustration":
      return "Client frustration";
    case "lowEngagement":
      return "Low engagement";
    case "scopeMismatch":
      return "Scope mismatch";
    default:
      return "No active objection";
  }
}

function topicToAddressRisk(risk?: string): LiveAnalysisTopic | null {
  switch (risk) {
    case "priceObjection":
      return "budget";
    case "timingObjection":
      return "timeline";
    case "trustConcern":
    case "securityConcern":
      return "securityCompliance";
    case "featureGap":
    case "integrationConcern":
      return "technicalFit";
    case "competitorMention":
      return "alternativesCompetitors";
    case "scopeMismatch":
      return "needProblem";
    default:
      return null;
  }
}

function SuggestionItem({
  id,
  text,
  confidence,
  used,
  rating,
  onCopy,
  onMarkUsed,
  onRate,
}: {
  id: string;
  text: string;
  confidence: number;
  used: boolean;
  rating?: "up" | "down";
  onCopy: () => Promise<void>;
  onMarkUsed: () => void;
  onRate: (rating: "up" | "down") => void;
}) {
  return (
    <div className="rounded-lg border border-warm-200/70 bg-white p-2">
      <p className="text-xs text-gray-700">{text}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-warm-500">
          Confidence: {Math.round(confidence * 100)}%
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            className="rounded border border-warm-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 hover:bg-warm-50"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onMarkUsed}
            className={`rounded border px-2 py-0.5 text-[10px] ${
              used
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-warm-200 bg-white text-gray-600 hover:bg-warm-50"
            }`}
          >
            {used ? "Used" : "Mark used"}
          </button>
          <button
            type="button"
            onClick={() => onRate("up")}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${
              rating === "up"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-warm-200 bg-white text-gray-600"
            }`}
            aria-label={`Helpful suggestion ${id}`}
            title="Helpful"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onRate("down")}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${
              rating === "down"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-warm-200 bg-white text-gray-600"
            }`}
            aria-label={`Not helpful suggestion ${id}`}
            title="Not helpful"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveAnalysisPanel({
  isSessionCompleted,
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
  summary,
  coach,
  insights,
  usedSuggestionIds,
  suggestionRatings,
  onCopySuggestion,
  onMarkSuggestionUsed,
  onRateSuggestion,
}: LiveAnalysisPanelProps) {
  const liveAnalysisToggleDisabled = true;
  const [copyToast, setCopyToast] = useState(false);
  const visibleInsights = isSessionCompleted ? insights : insights.slice(0, 8);
  const topRisk = metrics?.riskFlags[0];
  const pivotTopic =
    topicToAddressRisk(topRisk) ??
    LIVE_ANALYSIS_TOPICS.find(
      (topic) =>
        !(metrics?.topicCoverage.checkedTopics.includes(topic) ?? false),
    ) ??
    null;
  const primaryWorkaround =
    summary?.immediateActions[0] ?? coach?.nextBestSay[0]?.text ?? null;
  const topFollowUp = summary?.questionFollowUps.find(
    (item) => item.status === "missed" || item.status === "weak",
  );
  const primaryQuestion =
    topFollowUp?.questionText ?? coach?.nextQuestions[0]?.text ?? null;

  const handleCopy = async (text: string) => {
    const success = await onCopySuggestion(text);
    if (!success) return;
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 1200);
  };

  return (
    <aside className="h-full min-h-0 overflow-y-auto bg-warm-50/50 p-3">
      <div className="space-y-3">
        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                Live Analysis
              </h3>
              <p className="mt-0.5 text-[11px] text-warm-500">
                AI guidance may be inaccurate. Use judgment and follow consent
                laws.
              </p>
            </div>
            <label
              className={`inline-flex items-center gap-2 text-xs ${
                liveAnalysisToggleDisabled
                  ? "cursor-not-allowed text-gray-400"
                  : "cursor-pointer text-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={liveAnalysisToggleDisabled}
                className="h-4 w-4 rounded border-warm-300 text-indigo-600 focus:ring-indigo-500"
              />
              Enabled
            </label>
            {liveAnalysisToggleDisabled && (
              <p className="text-[10px] text-amber-600">Temporarily disabled</p>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between text-xs text-gray-700">
              <span>Private mode (local-first)</span>
              <input
                type="checkbox"
                checked={privacyMode}
                onChange={(event) => setPrivacyMode(event.target.checked)}
                className="h-4 w-4 rounded border-warm-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="block text-xs text-gray-700">
              <span>Sensitivity: {sensitivity}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>

            <label className="block text-xs text-gray-700">
              <span>Coaching frequency: {coachingAggressiveness}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={coachingAggressiveness}
                onChange={(event) =>
                  setCoachingAggressiveness(Number(event.target.value))
                }
                className="mt-1 w-full"
              />
            </label>

            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone(streamStatus)}`}
              >
                {streamStatus}
              </span>
              <span className="text-[10px] text-warm-500">
                Latency: {latencyMs ? `${latencyMs}ms` : "--"}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Overall Summary
          </h4>
          {summary ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    summary.overallAssessment === "strong"
                      ? "bg-green-100 text-green-700"
                      : summary.overallAssessment === "mixed"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {summary.overallAssessment}
                </span>
                <span className="text-[10px] text-warm-500">
                  Updated: {new Date(summary.updatedAtMs).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-gray-700">{summary.headline}</p>

              {summary.misses.length > 0 && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-red-600">
                    Risks To Fix
                  </p>
                  <div className="mt-1 space-y-1">
                    {summary.misses.slice(0, 3).map((miss, index) => (
                      <p
                        key={`${miss}-${String(index)}`}
                        className="text-[11px] text-red-700"
                      >
                        - {miss}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {summary.questionFollowUps.length > 0 && (
                <div className="rounded-lg border border-warm-200/70 bg-warm-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-warm-500">
                    Client Questions Handling
                  </p>
                  <div className="mt-1 space-y-1">
                    {(isSessionCompleted
                      ? summary.questionFollowUps
                      : summary.questionFollowUps.slice(0, 2)
                    ).map((item) => (
                      <div
                        key={item.questionId}
                        className="rounded bg-white px-2 py-1"
                      >
                        <p className="text-[11px] text-gray-700">
                          {item.questionText}
                        </p>
                        <p
                          className={`mt-0.5 text-[10px] font-medium ${
                            item.status === "answered"
                              ? "text-green-700"
                              : item.status === "weak"
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}
                        >
                          Status: {item.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-warm-500">
              Summary appears after enough transcript context is available.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Control Now
          </h4>
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-warm-200/70 bg-warm-50 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-warm-500">
                Objection
              </p>
              <p className="text-xs font-medium text-gray-800">
                {riskLabel(topRisk)}
              </p>
            </div>
            <div className="rounded-lg border border-warm-200/70 bg-warm-50 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-warm-500">
                Topic To Speak Now
              </p>
              <p className="text-xs font-medium text-gray-800">
                {pivotTopic
                  ? topicLabel(pivotTopic)
                  : "Clarify client priority"}
              </p>
            </div>
            <div className="rounded-lg border border-warm-200/70 bg-warm-50 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-warm-500">
                Workaround
              </p>
              <p className="text-xs text-gray-700">
                {primaryWorkaround ??
                  "Waiting for enough signal to suggest a workaround."}
              </p>
              {primaryQuestion && (
                <p className="mt-1 text-[11px] text-indigo-700">
                  Ask: {primaryQuestion}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Live Meters
          </h4>
          {metrics ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Client Sentiment</p>
                  <p
                    className={`text-sm font-semibold ${metricColor((metrics.clientValence + 1) / 2)}`}
                  >
                    {metrics.clientValence.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Engagement</p>
                  <p
                    className={`text-sm font-semibold ${metricColor(metrics.clientEngagement)}`}
                  >
                    {(metrics.clientEngagement * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Energy (Tone)</p>
                  <p
                    className={`text-sm font-semibold ${metricColor(metrics.clientEnergy)}`}
                  >
                    {(metrics.clientEnergy * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Call Health</p>
                  <p
                    className={`text-sm font-semibold ${metricColor(metrics.callHealth / 100)}`}
                  >
                    {metrics.callHealth.toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {(metrics.riskFlags.length > 0
                  ? metrics.riskFlags
                  : ["none"]
                ).map((flag) => (
                  <span
                    key={flag}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      flag === "none"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-warm-500">
              Metrics will appear after transcript data arrives.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
              Coach
            </h4>
            {copyToast && (
              <span className="text-[10px] text-green-600">Copied</span>
            )}
          </div>

          {coach ? (
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[11px] font-medium text-gray-700">
                  Say this next
                </p>
                <div className="space-y-1.5">
                  {coach.nextBestSay.map((item) => (
                    <SuggestionItem
                      key={item.suggestionId}
                      id={item.suggestionId}
                      text={item.text}
                      confidence={item.confidence}
                      used={usedSuggestionIds.has(item.suggestionId)}
                      rating={suggestionRatings[item.suggestionId]}
                      onCopy={() => handleCopy(item.text)}
                      onMarkUsed={() => onMarkSuggestionUsed(item.suggestionId)}
                      onRate={(rating) =>
                        onRateSuggestion(item.suggestionId, rating)
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-medium text-gray-700">
                  Ask next
                </p>
                <div className="space-y-1.5">
                  {coach.nextQuestions.map((item) => (
                    <SuggestionItem
                      key={item.questionId}
                      id={item.questionId}
                      text={item.text}
                      confidence={item.confidence}
                      used={usedSuggestionIds.has(item.questionId)}
                      rating={suggestionRatings[item.questionId]}
                      onCopy={() => handleCopy(item.text)}
                      onMarkUsed={() => onMarkSuggestionUsed(item.questionId)}
                      onRate={(rating) =>
                        onRateSuggestion(item.questionId, rating)
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-medium text-gray-700">
                  Do / Don't
                </p>
                <div className="space-y-1.5">
                  {coach.doDont.map((item) => (
                    <SuggestionItem
                      key={item.id}
                      id={item.id}
                      text={`${item.type.toUpperCase()}: ${item.text}`}
                      confidence={item.confidence}
                      used={usedSuggestionIds.has(item.id)}
                      rating={suggestionRatings[item.id]}
                      onCopy={() => handleCopy(item.text)}
                      onMarkUsed={() => onMarkSuggestionUsed(item.id)}
                      onRate={(rating) => onRateSuggestion(item.id, rating)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-warm-500">
              Deep coaching appears every few seconds when Live Analysis is
              enabled.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Insights Timeline
          </h4>
          {insights.length > 0 ? (
            <div className="mt-2 space-y-2">
              {visibleInsights.map((insight) => (
                <div
                  key={insight.insightId}
                  className="rounded-lg border border-warm-200/70 bg-warm-50 p-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-800">
                      {insight.title}
                    </p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        insight.severity === "high"
                          ? "bg-red-100 text-red-700"
                          : insight.severity === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {insight.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">
                    {insight.detail}
                  </p>
                  {insight.evidenceSnippets.length > 0 && (
                    <p className="mt-1 text-[10px] text-warm-500">
                      "{insight.evidenceSnippets[0]?.text}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-warm-500">
              No timeline events yet.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Talk Dynamics
          </h4>
          {metrics ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <p>Sales Talk %: {metrics.talkDynamics.talkRatioSalesPct}%</p>
              <p>Client Talk %: {metrics.talkDynamics.talkRatioClientPct}%</p>
              <p>Interruptions: {metrics.talkDynamics.interruptionsCount}</p>
              <p>Sales Pace: {metrics.talkDynamics.paceWpmSales} wpm</p>
              <p>Client Pace: {metrics.talkDynamics.paceWpmClient} wpm</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-warm-500">Waiting for metrics...</p>
          )}
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Topic Coverage
          </h4>
          {metrics ? (
            <div className="mt-2 grid grid-cols-1 gap-1">
              {LIVE_ANALYSIS_TOPICS.map((topic) => {
                const checked =
                  metrics.topicCoverage.checkedTopics.includes(topic);
                const confidence =
                  metrics.topicCoverage.confidenceByTopic[topic] ?? 0;
                return (
                  <div
                    key={topic}
                    className="flex items-center justify-between rounded bg-warm-50 px-2 py-1 text-xs"
                  >
                    <span
                      className={checked ? "text-green-700" : "text-gray-600"}
                    >
                      {checked ? "x " : "o "}
                      {topicLabel(topic)}
                    </span>
                    <span className="text-[10px] text-warm-500">
                      {Math.round(confidence * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-warm-500">
              Topic coverage appears once analysis starts.
            </p>
          )}
        </section>

        {!enabled && (
          <div className="rounded-lg border border-dashed border-warm-300 bg-warm-50 p-3 text-center">
            <p className="text-xs text-warm-500">
              Enable Live Analysis to start real-time coaching.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={liveAnalysisToggleDisabled}
              onClick={() => setEnabled(true)}
            >
              Enable
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
