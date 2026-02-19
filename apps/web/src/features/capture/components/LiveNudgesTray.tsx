"use client";

import { useMemo } from "react";
import type {
  LiveAnalysisCallSummary,
  LiveAnalysisCoachPayload,
  LiveAnalysisInsight,
  LiveAnalysisMetrics,
  LiveAnalysisRiskFlag,
} from "../live-analysis/types";

type NudgeTone = "blue" | "amber" | "red";

interface NudgeItem {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: NudgeTone;
  timestampMs: number;
}

interface LiveNudgesTrayProps {
  visible: boolean;
  enabled: boolean;
  metrics: LiveAnalysisMetrics | null;
  coach: LiveAnalysisCoachPayload | null;
  summary: LiveAnalysisCallSummary | null;
  insights: LiveAnalysisInsight[];
}

function riskLabel(risk: LiveAnalysisRiskFlag): string {
  switch (risk) {
    case "priceObjection":
      return "pricing concern";
    case "timingObjection":
      return "timing pushback";
    case "trustConcern":
      return "trust concern";
    case "featureGap":
      return "feature gap";
    case "securityConcern":
      return "security concern";
    case "integrationConcern":
      return "integration concern";
    case "competitorMention":
      return "competitor pressure";
    case "confusion":
      return "customer confusion";
    case "frustration":
      return "customer frustration";
    case "lowEngagement":
      return "low engagement";
    case "scopeMismatch":
      return "scope mismatch";
  }
}

function riskTone(risk: LiveAnalysisRiskFlag): NudgeTone {
  switch (risk) {
    case "frustration":
    case "trustConcern":
    case "securityConcern":
    case "scopeMismatch":
      return "red";
    case "priceObjection":
    case "timingObjection":
    case "integrationConcern":
    case "featureGap":
      return "amber";
    default:
      return "blue";
  }
}

function toneClasses(tone: NudgeTone): {
  border: string;
  label: string;
} {
  switch (tone) {
    case "red":
      return {
        border: "border-l-red-500",
        label: "bg-red-50 text-red-700",
      };
    case "amber":
      return {
        border: "border-l-amber-500",
        label: "bg-amber-50 text-amber-700",
      };
    default:
      return {
        border: "border-l-indigo-500",
        label: "bg-indigo-50 text-indigo-700",
      };
  }
}

export function LiveNudgesTray({
  visible,
  enabled,
  metrics,
  coach,
  summary,
  insights,
}: LiveNudgesTrayProps) {
  const nudges = useMemo(() => {
    if (!metrics && !summary && !coach) return [] as NudgeItem[];

    const nowTs =
      summary?.updatedAtMs ??
      metrics?.windowTsEndMs ??
      insights[0]?.timestampMs;
    if (!nowTs) return [] as NudgeItem[];
    const items: NudgeItem[] = [];
    const topRisk = metrics?.riskFlags[0];
    const bestSay = coach?.nextBestSay[0]?.text;
    const bestQuestion = coach?.nextQuestions[0]?.text;
    const coachDetail =
      bestSay ??
      bestQuestion ??
      "Acknowledge concern, then ask one clarifying question.";

    if (summary?.overallAssessment === "atRisk") {
      items.push({
        id: "deal-at-risk",
        label: "Deal Risk",
        title: "Deal likely to stall without intervention",
        detail:
          summary.immediateActions[0] ??
          summary.misses[0] ??
          "Re-anchor on client priority, then lock one concrete next step.",
        tone: "red",
        timestampMs: summary.updatedAtMs,
      });
    } else if (summary?.overallAssessment === "mixed") {
      items.push({
        id: "deal-delay-risk",
        label: "Delay Risk",
        title: "Momentum is mixed; timeline may slip",
        detail:
          summary.immediateActions[0] ??
          summary.misses[0] ??
          "Address open objections before proposing a next milestone.",
        tone: "amber",
        timestampMs: summary.updatedAtMs,
      });
    }

    if (topRisk) {
      const riskTitle =
        topRisk === "timingObjection"
          ? "Client signaling delay risk"
          : topRisk === "priceObjection"
            ? "Budget concern can block approval"
            : `Address ${riskLabel(topRisk)} now`;
      items.push({
        id: `risk-${topRisk}`,
        label: "Objection Alert",
        title: riskTitle,
        detail:
          coachDetail ??
          insights.find(
            (item) => item.type === "objection" || item.type === "risk",
          )?.detail ??
          "Mirror the concern and ask what must be true to move forward.",
        tone: riskTone(topRisk),
        timestampMs: nowTs,
      });
    }

    if (
      metrics &&
      (metrics.clientValence <= -0.2 || metrics.clientEngagement <= 0.4)
    ) {
      items.push({
        id: "sentiment-alert",
        label: "Sentiment Alert",
        title:
          metrics.clientEngagement <= 0.4
            ? "Customer disengaging: re-open discovery"
            : "Customer skeptical: clarify root concern",
        detail:
          bestQuestion ??
          "What is the biggest blocker preventing confidence right now?",
        tone: "amber",
        timestampMs: nowTs,
      });
    }

    const missedFollowUp = summary?.questionFollowUps.find(
      (item) => item.status === "missed" || item.status === "weak",
    );
    if (missedFollowUp) {
      items.push({
        id: `followup-${missedFollowUp.questionId}`,
        label: "Follow-up Alert",
        title:
          missedFollowUp.status === "missed"
            ? "Client question not answered directly"
            : "Client question answered weakly",
        detail: missedFollowUp.suggestedRecovery,
        tone: missedFollowUp.status === "missed" ? "red" : "amber",
        timestampMs: summary?.updatedAtMs ?? nowTs,
      });
    }

    const latestInsight = insights[0];
    if (latestInsight) {
      items.push({
        id: `insight-${latestInsight.insightId}`,
        label: "Live Insight",
        title: latestInsight.title,
        detail: latestInsight.detail,
        tone: latestInsight.severity === "high" ? "red" : "blue",
        timestampMs: latestInsight.timestampMs,
      });
    }

    if (items.length === 0 && coach?.nextBestSay[0]) {
      items.push({
        id: "coach-live-fallback",
        label: "Live Nudge",
        title: "Conversation in progress",
        detail: coach.nextBestSay[0].text,
        tone: "blue",
        timestampMs: nowTs,
      });
    }

    const unique = new Map<string, NudgeItem>();
    for (const item of items) {
      if (!unique.has(item.id)) unique.set(item.id, item);
    }

    const ordered = [...unique.values()]
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .slice(0, 3);
    return ordered;
  }, [coach, insights, metrics, summary]);

  if (!visible || !enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 px-3">
      <div className="mx-auto w-full max-w-2xl space-y-2">
        <div className="pointer-events-none px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
          Live Sales Nudges
        </div>
        {nudges.length === 0 ? (
          <article className="pointer-events-auto rounded-2xl border border-gray-100 border-l-4 border-l-indigo-500 bg-white p-3 shadow-lg">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Live
              </span>
              <span className="text-[11px] text-gray-500">Listening...</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              Waiting for actionable signals
            </p>
            <p className="mt-1 text-[13px] leading-5 text-gray-700">
              Nudges will appear as soon as the analysis detects objections,
              delay risk, sentiment change, or missed follow-ups.
            </p>
          </article>
        ) : (
          nudges.map((item) => {
            const tone = toneClasses(item.tone);
            return (
              <article
                key={item.id}
                className={`pointer-events-auto rounded-2xl border border-gray-100 border-l-4 ${tone.border} bg-white p-3 shadow-lg`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.label}`}
                  >
                    {item.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {item.title}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-gray-700">
                  {item.detail}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
