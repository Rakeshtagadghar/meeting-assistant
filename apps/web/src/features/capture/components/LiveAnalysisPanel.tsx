"use client";

import { useMemo, useState } from "react";
import {
  LIVE_ANALYSIS_TOPICS,
  type LiveAnalysisCallSummary,
  type LiveAnalysisCoachDoDont,
  type LiveAnalysisCoachQuestion,
  type LiveAnalysisCoachSuggestion,
  type LiveAnalysisMetrics,
  type LiveAnalysisPainPoint,
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
    painPoints: LiveAnalysisPainPoint[];
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
      return "No active flag";
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

function insightLabel(type: string): string {
  switch (type) {
    case "objection":
      return "Objection";
    case "risk":
      return "Risk";
    case "positiveSignal":
      return "Positive signal";
    case "topic":
      return "Key topic";
    case "coach":
      return "Coach";
    default:
      return "Insight";
  }
}

function severityTone(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function formatConfidence(value: number): string {
  return `${String(Math.round(value * 100))}%`;
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
          Confidence: {formatConfidence(confidence)}
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
  const [copyToast, setCopyToast] = useState(false);
  const [topicOverrides, setTopicOverrides] = useState<
    Partial<Record<LiveAnalysisTopic, boolean>>
  >({});

  const visibleInsights = isSessionCompleted ? insights : insights.slice(0, 12);
  const topRisk = metrics?.riskFlags[0] ?? undefined;
  const unresolvedTopic =
    topicToAddressRisk(topRisk) ??
    LIVE_ANALYSIS_TOPICS.find(
      (topic) =>
        !(metrics?.topicCoverage.checkedTopics.includes(topic) ?? false),
    ) ??
    null;

  const timelineItems = useMemo(() => {
    if (!metrics || metrics.clientValence > -0.3) {
      return visibleInsights.slice(0, 12);
    }

    return [
      {
        insightId: "sentiment-drop-derived",
        timestampMs: metrics.windowTsEndMs,
        type: "risk",
        severity: "high" as const,
        title: "Sentiment drop",
        detail:
          "Client sentiment dropped in the latest analysis window. Address concerns directly.",
        confidence: metrics.clientValenceConfidence,
        evidenceSnippets: [] as Array<{ text: string }>,
      },
      ...visibleInsights,
    ].slice(0, 12);
  }, [metrics, visibleInsights]);

  const painPoints = useMemo(() => {
    if (coach?.painPoints?.length) {
      return coach.painPoints.slice(0, 5).map((item, index) => ({
        key: `coach-pain-${String(index)}`,
        title: item.title,
        detail: item.detail,
        confidence: item.confidence,
      }));
    }

    return [
      ...visibleInsights
        .filter((item) => item.type === "risk" || item.type === "objection")
        .map((item) => ({
          key: item.insightId,
          title: item.title,
          detail: item.detail,
          confidence: item.confidence,
        })),
      ...(summary?.misses.map((miss, index) => ({
        key: `summary-miss-${String(index)}`,
        title: "Detected friction",
        detail: miss,
        confidence: 0.6,
      })) ?? []),
    ].slice(0, 5);
  }, [coach?.painPoints, summary, visibleInsights]);

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
                AI guidance may be inaccurate. Use your judgment and ensure
                participant consent as required by law.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-warm-300 text-indigo-600 focus:ring-indigo-500"
              />
              Enabled
            </label>
          </div>

          <div className="mt-3 space-y-2 rounded-lg border border-warm-200/70 bg-warm-50 p-2">
            <label className="flex items-center justify-between text-xs text-gray-700">
              <span>Privacy mode</span>
              <input
                type="checkbox"
                checked={privacyMode}
                onChange={(event) => setPrivacyMode(event.target.checked)}
                className="h-4 w-4 rounded border-warm-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="block text-xs text-gray-700">
              <span>Sensitivity: {String(sensitivity)}</span>
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
              <span>
                Coaching aggressiveness: {String(coachingAggressiveness)}
              </span>
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
            Meters
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
                  <p className="text-[10px] text-warm-500">
                    Confidence{" "}
                    {formatConfidence(metrics.clientValenceConfidence)}
                  </p>
                </div>
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Engagement</p>
                  <p
                    className={`text-sm font-semibold ${metricColor(metrics.clientEngagement)}`}
                  >
                    {(metrics.clientEngagement * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-warm-500">
                    Confidence{" "}
                    {formatConfidence(metrics.clientEngagementConfidence)}
                  </p>
                </div>
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Energy (Tone)</p>
                  <p
                    className={`text-sm font-semibold ${metricColor(metrics.clientEnergy)}`}
                  >
                    {(metrics.clientEnergy * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-warm-500">
                    Stress {(metrics.clientStress * 100).toFixed(0)}% |
                    Certainty {(metrics.clientCertainty * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg bg-warm-50 p-2">
                  <p className="text-[10px] text-warm-500">Call Health</p>
                  <p
                    className={`text-sm font-semibold ${metricColor(metrics.callHealth / 100)}`}
                  >
                    {metrics.callHealth.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-warm-500">
                    Confidence {formatConfidence(metrics.callHealthConfidence)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[10px] text-warm-500">
                  Primary flag: {riskLabel(topRisk)}
                </p>
                {unresolvedTopic && (
                  <p className="text-[10px] text-indigo-700">
                    Suggested topic: {topicLabel(unresolvedTopic)}
                  </p>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
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

              <div>
                <p className="mb-1 text-[11px] font-medium text-gray-700">
                  Pain points detected
                </p>
                <div className="space-y-1.5">
                  {painPoints.length > 0 ? (
                    painPoints.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-lg border border-warm-200/70 bg-warm-50 p-2"
                      >
                        <p className="text-[11px] font-medium text-gray-700">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-600">
                          {item.detail}
                        </p>
                        <p className="mt-1 text-[10px] text-warm-500">
                          Confidence {formatConfidence(item.confidence)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-warm-500">
                      No strong pain points detected yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-warm-500">
              Coaching appears as analysis confidence increases.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-warm-200/70 bg-white p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-500">
            Insights Timeline
          </h4>
          {timelineItems.length > 0 ? (
            <div className="mt-2 space-y-2">
              {timelineItems.map((insight) => (
                <div
                  key={insight.insightId}
                  className="rounded-lg border border-warm-200/70 bg-warm-50 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${severityTone(insight.severity)}`}
                    >
                      {insight.severity}
                    </span>
                    <span className="text-[10px] text-warm-500">
                      {insightLabel(insight.type)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-gray-800">
                    {insight.title}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-600">
                    {insight.detail}
                  </p>
                  <p className="mt-1 text-[10px] text-warm-500">
                    Confidence {formatConfidence(insight.confidence)}
                  </p>
                  {insight.evidenceSnippets.length > 0 && (
                    <p className="mt-1 text-[10px] text-warm-500">
                      Evidence: "{insight.evidenceSnippets[0]?.text}"
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
            <>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTopicOverrides({})}
                  className="text-[10px] text-indigo-700 hover:underline"
                >
                  Reset manual overrides
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {LIVE_ANALYSIS_TOPICS.map((topic) => {
                  const autoChecked =
                    metrics.topicCoverage.checkedTopics.includes(topic);
                  const checked = topicOverrides[topic] ?? autoChecked;
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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-warm-500">
                          {Math.round(confidence * 100)}%
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setTopicOverrides((current) => ({
                              ...current,
                              [topic]: event.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-warm-300 text-indigo-600"
                          aria-label={`Toggle ${topicLabel(topic)} topic`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-warm-500">
              Topic coverage appears once analysis starts.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
