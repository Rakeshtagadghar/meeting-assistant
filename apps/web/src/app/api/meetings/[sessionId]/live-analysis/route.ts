import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient } from "@ainotes/ai";
import { AI_MODELS } from "@ainotes/config/ai-models";
import type { UUID } from "@ainotes/core";
import {
  type LiveAnalysisCallSummary,
  type LiveAnalysisChunkInput,
  type LiveAnalysisCoachPayload,
  type LiveAnalysisInsight,
  type LiveAnalysisMode,
  type LiveAnalysisPainPoint,
  type LiveAnalysisRequestBody,
  type LiveAnalysisResponse,
} from "@/features/capture/live-analysis/types";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createMeetingSessionsRepository,
  createTranscriptChunksRepository,
} from "@/lib/db";
import { buildHeuristicLiveAnalysis } from "@/lib/live-analysis/engine";

const sessionsRepo = createMeetingSessionsRepository(prisma);
const chunksRepo = createTranscriptChunksRepository(prisma);
const ANALYSIS_MAX_DELTA_UTTERANCES = 12;
const ANALYSIS_MAX_EVIDENCE_SNIPPETS = 6;
const ANALYSIS_MAX_MEMORY_CHARS = 2500;

const requestSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["light", "deep"]).default("light"),
  privacyMode: z.boolean().optional().default(false),
  useHeuristics: z.boolean().optional().default(true),
  sensitivity: z.number().min(0).max(100).optional().default(50),
  coachingAggressiveness: z.number().min(0).max(100).optional().default(40),
  chunks: z
    .array(
      z.object({
        id: z.string().optional(),
        sequence: z.number().int().optional(),
        tStartMs: z.number().min(0),
        tEndMs: z.number().min(0),
        speaker: z.string().nullable(),
        speakerRole: z.enum(["SALES", "CLIENT", "UNKNOWN", "MIXED"]).optional(),
        audioSource: z
          .enum(["microphone", "systemAudio", "tabAudio"])
          .optional(),
        prosodyEnergy: z.number().min(0).max(1).nullable().optional(),
        prosodyPauseRatio: z.number().min(0).max(1).nullable().optional(),
        prosodyVoicedMs: z.number().min(0).nullable().optional(),
        prosodySnrDb: z.number().nullable().optional(),
        prosodyQualityPass: z.boolean().nullable().optional(),
        prosodyToneWeightsEnabled: z.boolean().nullable().optional(),
        prosodyConfidencePenalty: z
          .number()
          .min(0)
          .max(1)
          .nullable()
          .optional(),
        prosodyClientEnergy: z.number().min(0).max(1).nullable().optional(),
        prosodyClientStress: z.number().min(0).max(1).nullable().optional(),
        prosodyClientCertainty: z.number().min(0).max(1).nullable().optional(),
        text: z.string().min(1),
        confidence: z.number().min(0).max(1).nullable(),
      }),
    )
    .max(180)
    .optional(),
  partialText: z.string().nullable().optional(),
});

const groqResponseSchema = z.object({
  nextBestSay: z
    .array(
      z.object({
        text: z.string().min(1),
        intent: z.enum([
          "addressObjection",
          "clarify",
          "valueReinforce",
          "close",
          "discovery",
          "rapport",
        ]),
        confidence: z.number().min(0).max(1),
        evidenceSnippets: z.array(z.string().min(1)).max(3),
      }),
    )
    .max(3)
    .optional(),
  nextQuestions: z
    .array(
      z.object({
        text: z.string().min(1),
        intent: z.enum([
          "discovery",
          "budget",
          "timeline",
          "dm",
          "risk",
          "close",
        ]),
        confidence: z.number().min(0).max(1),
        evidenceSnippets: z.array(z.string().min(1)).max(3),
      }),
    )
    .max(3)
    .optional(),
  doDont: z
    .array(
      z.object({
        type: z.enum(["do", "dont"]),
        text: z.string().min(1),
        confidence: z.number().min(0).max(1),
        evidenceSnippets: z.array(z.string().min(1)).max(3),
      }),
    )
    .max(4)
    .optional(),
  painPoints: z
    .array(
      z.object({
        title: z.string().min(1),
        detail: z.string().min(1),
        category: z.enum([
          "cost",
          "time",
          "risk",
          "integration",
          "compliance",
          "usability",
          "performance",
          "trust",
          "support",
          "other",
        ]),
        confidence: z.number().min(0).max(1),
        evidenceUtteranceIds: z.array(z.string().min(1)).max(4),
      }),
    )
    .max(5)
    .optional(),
  insights: z
    .array(
      z.object({
        type: z.enum(["objection", "risk", "positiveSignal", "topic", "coach"]),
        severity: z.enum(["low", "medium", "high"]),
        title: z.string().min(1),
        detail: z.string().min(1),
        confidence: z.number().min(0).max(1),
        evidenceSnippets: z.array(z.string().min(1)).max(3),
      }),
    )
    .max(5)
    .optional(),
  summary: z
    .object({
      overallAssessment: z.enum(["strong", "mixed", "atRisk"]),
      headline: z.string().min(1),
      strengths: z.array(z.string().min(1)).max(4),
      misses: z.array(z.string().min(1)).max(5),
      immediateActions: z.array(z.string().min(1)).max(4),
      questionFollowUps: z
        .array(
          z.object({
            questionText: z.string().min(1),
            status: z.enum(["answered", "weak", "missed"]),
            responseText: z.string().min(1).nullable().optional(),
            suggestedRecovery: z.string().min(1),
          }),
        )
        .max(6),
    })
    .optional(),
});

const coachCache = new Map<
  string,
  {
    updatedAtMs: number;
    coach: LiveAnalysisCoachPayload;
    insights: LiveAnalysisInsight[];
    summary: LiveAnalysisCallSummary;
  }
>();

interface LiveAnalysisMeetingMemory {
  summary: string;
  painPoints: string[];
  objections: string[];
  constraints: string[];
  budgetSignals: string[];
  timelineSignals: string[];
  decisionMakerSignals: string[];
  competitorMentions: string[];
  securityConcerns: string[];
  nextSteps: string[];
  promisesMade: string[];
}

const meetingMemoryStore = new Map<
  string,
  { updatedAtMs: number; memory: LiveAnalysisMeetingMemory }
>();

function emptyMeetingMemory(): LiveAnalysisMeetingMemory {
  return {
    summary: "",
    painPoints: [],
    objections: [],
    constraints: [],
    budgetSignals: [],
    timelineSignals: [],
    decisionMakerSignals: [],
    competitorMentions: [],
    securityConcerns: [],
    nextSteps: [],
    promisesMade: [],
  };
}

function dedupeTake(items: string[], maxItems = 8): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(
    0,
    maxItems,
  );
}

function compactText(value: string, max = ANALYSIS_MAX_MEMORY_CHARS): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function redactText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card]");
}

function redactChunks(
  chunks: LiveAnalysisChunkInput[],
): LiveAnalysisChunkInput[] {
  return chunks.map((chunk) => ({
    ...chunk,
    text: redactText(chunk.text),
  }));
}

function mergeMeetingMemory(args: {
  current: LiveAnalysisMeetingMemory;
  summary: LiveAnalysisCallSummary;
  insights: LiveAnalysisInsight[];
  painPoints: LiveAnalysisPainPoint[];
}): LiveAnalysisMeetingMemory {
  const objectionTitles = args.insights
    .filter((item) => item.type === "objection" || item.type === "risk")
    .map((item) => item.title);
  const competitorMentions = args.insights
    .filter((item) => /competitor/i.test(item.title + item.detail))
    .map((item) => item.detail);
  const securityConcerns = args.insights
    .filter((item) =>
      /security|compliance|trust/i.test(item.title + item.detail),
    )
    .map((item) => item.detail);

  const nextSteps = [
    ...args.current.nextSteps,
    ...args.summary.immediateActions,
  ];
  const constraints = [
    ...args.current.constraints,
    ...args.summary.misses.filter((miss) =>
      /constraint|block|risk/i.test(miss),
    ),
  ];
  const budgetSignals = [
    ...args.current.budgetSignals,
    ...args.insights
      .filter((item) => /budget|price|cost/i.test(item.title + item.detail))
      .map((item) => item.detail),
  ];
  const timelineSignals = [
    ...args.current.timelineSignals,
    ...args.insights
      .filter((item) =>
        /timeline|quarter|deadline|later/i.test(item.title + item.detail),
      )
      .map((item) => item.detail),
  ];
  const decisionMakerSignals = [
    ...args.current.decisionMakerSignals,
    ...args.insights
      .filter((item) =>
        /decision|stakeholder|approver/i.test(item.title + item.detail),
      )
      .map((item) => item.detail),
  ];
  const promisesMade = [
    ...args.current.promisesMade,
    ...args.summary.strengths.filter((item) =>
      /confirm|promise|commit/i.test(item),
    ),
  ];

  return {
    summary: compactText(
      dedupeTake([args.current.summary, args.summary.headline], 2).join(" "),
    ),
    painPoints: dedupeTake([
      ...args.current.painPoints,
      ...args.painPoints.map((item) => item.title),
    ]),
    objections: dedupeTake([...args.current.objections, ...objectionTitles]),
    constraints: dedupeTake(constraints),
    budgetSignals: dedupeTake(budgetSignals),
    timelineSignals: dedupeTake(timelineSignals),
    decisionMakerSignals: dedupeTake(decisionMakerSignals),
    competitorMentions: dedupeTake([
      ...args.current.competitorMentions,
      ...competitorMentions,
    ]),
    securityConcerns: dedupeTake([
      ...args.current.securityConcerns,
      ...securityConcerns,
    ]),
    nextSteps: dedupeTake(nextSteps),
    promisesMade: dedupeTake(promisesMade),
  };
}

function truncateText(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

function mergeChunks(
  stored: LiveAnalysisChunkInput[],
  clientChunks: LiveAnalysisChunkInput[],
): LiveAnalysisChunkInput[] {
  const merged = new Map<string, LiveAnalysisChunkInput>();

  const pushChunk = (chunk: LiveAnalysisChunkInput) => {
    const key =
      chunk.id ??
      `${String(chunk.sequence ?? -1)}:${String(chunk.tStartMs)}:${String(chunk.tEndMs)}:${chunk.text}`;
    merged.set(key, chunk);
  };

  stored.forEach(pushChunk);
  clientChunks.forEach(pushChunk);

  return [...merged.values()].sort((a, b) => {
    if (a.tStartMs !== b.tStartMs) return a.tStartMs - b.tStartMs;
    if (a.tEndMs !== b.tEndMs) return a.tEndMs - b.tEndMs;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const direct = (() => {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (direct) return direct;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function refineCoachWithGroq(args: {
  mode: LiveAnalysisMode;
  meetingId: string;
  chunks: LiveAnalysisChunkInput[];
  meetingMemory: LiveAnalysisMeetingMemory;
  baseCoach: LiveAnalysisCoachPayload;
  baseInsights: LiveAnalysisInsight[];
  baseSummary: LiveAnalysisCallSummary;
  sensitivity: number;
  coachingAggressiveness: number;
}): Promise<{
  coach: LiveAnalysisCoachPayload;
  insights: LiveAnalysisInsight[];
  summary: LiveAnalysisCallSummary;
} | null> {
  if (args.mode !== "deep" || !process.env.GROQ_API_KEY) {
    return null;
  }

  const transcriptPreview = args.chunks
    .slice(-ANALYSIS_MAX_DELTA_UTTERANCES)
    .map((chunk) => {
      const speaker = chunk.speaker ?? "Unknown";
      return `[${speaker}] ${truncateText(chunk.text, 180)}`;
    })
    .join("\n");

  if (!transcriptPreview.trim()) return null;

  const prompt = [
    "You are a live sales-call coach.",
    "Use only provided transcript; do not invent details.",
    "Avoid manipulative, deceptive, or sensitive inferences.",
    "Always include evidence-driven reasoning and lower confidence if unsure.",
    "Return strict JSON only with keys: nextBestSay, nextQuestions, doDont, painPoints, insights, summary.",
    "Each suggestion must be short and actionable and include evidenceSnippets.",
    "Summary should be concise and executive-friendly for the sales rep.",
    `Limit to max ${String(ANALYSIS_MAX_EVIDENCE_SNIPPETS)} evidence snippets across all lists.`,
    `Sensitivity: ${String(args.sensitivity)}/100.`,
    `CoachingAggressiveness: ${String(args.coachingAggressiveness)}/100.`,
    "",
    "Transcript:",
    transcriptPreview,
    "",
    "Meeting memory:",
    JSON.stringify(args.meetingMemory, null, 2),
    "",
    "Current heuristic coach:",
    JSON.stringify(
      {
        nextBestSay: args.baseCoach.nextBestSay,
        nextQuestions: args.baseCoach.nextQuestions,
        doDont: args.baseCoach.doDont,
      },
      null,
      2,
    ),
    "",
    "Current heuristic summary:",
    JSON.stringify(args.baseSummary, null, 2),
  ].join("\n");

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: AI_MODELS.groq.chatCompletion,
      temperature: 0.2,
      max_completion_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are an expert B2B live meeting coach. Always return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    if (!content) return null;
    const parsed = parseJsonObject(content);
    if (!parsed) return null;

    const validated = groqResponseSchema.safeParse(parsed);
    if (!validated.success) return null;

    const now = Date.now();
    const mergedCoach: LiveAnalysisCoachPayload = {
      ...args.baseCoach,
      generatedAtMs: now,
      nextBestSay:
        validated.data.nextBestSay?.map((item, index) => ({
          suggestionId: `groq-say-${String(index + 1)}`,
          text: item.text,
          intent: item.intent,
          confidence: Number(item.confidence.toFixed(2)),
          evidenceSnippets: item.evidenceSnippets.map((value) =>
            truncateText(value, 140),
          ),
        })) ?? args.baseCoach.nextBestSay,
      nextQuestions:
        validated.data.nextQuestions?.map((item, index) => ({
          questionId: `groq-ask-${String(index + 1)}`,
          text: item.text,
          intent: item.intent,
          confidence: Number(item.confidence.toFixed(2)),
          evidenceSnippets: item.evidenceSnippets.map((value) =>
            truncateText(value, 140),
          ),
        })) ?? args.baseCoach.nextQuestions,
      doDont:
        validated.data.doDont?.map((item, index) => ({
          id: `groq-dodont-${String(index + 1)}`,
          type: item.type,
          text: item.text,
          confidence: Number(item.confidence.toFixed(2)),
          evidenceSnippets: item.evidenceSnippets.map((value) =>
            truncateText(value, 140),
          ),
        })) ?? args.baseCoach.doDont,
      painPoints:
        validated.data.painPoints?.map((item) => ({
          title: truncateText(item.title, 120),
          detail: truncateText(item.detail, 220),
          category: item.category,
          confidence: Number(item.confidence.toFixed(2)),
          evidenceUtteranceIds: item.evidenceUtteranceIds.slice(0, 4),
        })) ?? args.baseCoach.painPoints,
    };

    const mergedInsights =
      validated.data.insights?.map((item, index) => ({
        meetingId: args.meetingId,
        insightId: `groq-insight-${String(index + 1)}`,
        timestampMs: now,
        type: item.type,
        severity: item.severity,
        title: item.title,
        detail: item.detail,
        confidence: Number(item.confidence.toFixed(2)),
        evidenceSnippets: item.evidenceSnippets.map((text, evidenceIndex) => ({
          utteranceId: `groq-evidence-${String(index + 1)}-${String(evidenceIndex + 1)}`,
          speakerRole: "UNKNOWN" as const,
          tsStartMs: now,
          tsEndMs: now,
          text: truncateText(text, 220),
        })),
      })) ?? args.baseInsights;

    const mergedSummary: LiveAnalysisCallSummary = {
      updatedAtMs: now,
      overallAssessment:
        validated.data.summary?.overallAssessment ??
        args.baseSummary.overallAssessment,
      headline: truncateText(
        validated.data.summary?.headline ?? args.baseSummary.headline,
        220,
      ),
      strengths:
        validated.data.summary?.strengths.map((item) =>
          truncateText(item, 160),
        ) ?? args.baseSummary.strengths,
      misses:
        validated.data.summary?.misses.map((item) => truncateText(item, 180)) ??
        args.baseSummary.misses,
      immediateActions:
        validated.data.summary?.immediateActions.map((item) =>
          truncateText(item, 180),
        ) ?? args.baseSummary.immediateActions,
      questionFollowUps:
        validated.data.summary?.questionFollowUps.map((item, index) => ({
          questionId: `groq-qf-${String(index + 1)}`,
          questionText: truncateText(item.questionText, 220),
          askedAtMs: now,
          status: item.status,
          responseText: item.responseText
            ? truncateText(item.responseText, 220)
            : null,
          suggestedRecovery: truncateText(item.suggestedRecovery, 220),
        })) ?? args.baseSummary.questionFollowUps,
    };

    return {
      coach: mergedCoach,
      insights: mergedInsights,
      summary: mergedSummary,
    };
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const startTs = Date.now();

  try {
    const userId = await getAuthUserId();
    if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

    const { sessionId } = await params;
    const session = await sessionsRepo.findById(sessionId as UUID);
    if (!session) return apiError(ApiErrorCode.NOT_FOUND);
    if (session.userId !== userId) return apiError(ApiErrorCode.FORBIDDEN);

    let rawBody: LiveAnalysisRequestBody;
    try {
      rawBody = (await request.json()) as LiveAnalysisRequestBody;
    } catch {
      return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid JSON body");
    }

    const parsedBody = requestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError(
        ApiErrorCode.VALIDATION_ERROR,
        parsedBody.error.issues.map((issue) => issue.message),
      );
    }
    const body = parsedBody.data;
    const mode: LiveAnalysisMode = body.mode;

    if (!body.enabled) {
      coachCache.delete(sessionId);
      meetingMemoryStore.delete(sessionId);
      const response: LiveAnalysisResponse = {
        meetingId: sessionId,
        streamStatus: "idle",
        latencyMs: Date.now() - startTs,
        mode,
        metrics: null,
        coach: null,
        insights: [],
        summary: null,
      };
      return NextResponse.json(response);
    }

    const dbChunks = await chunksRepo.findBySessionId(sessionId as UUID, {
      limit: 160,
    });

    const storedChunks: LiveAnalysisChunkInput[] = dbChunks.map((chunk) => ({
      id: chunk.id,
      sequence: chunk.sequence,
      tStartMs: chunk.tStartMs,
      tEndMs: chunk.tEndMs,
      speaker: chunk.speaker,
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
    }));

    const clientChunks = (body.chunks ?? []).map((chunk) => ({
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
    }));

    if (body.partialText?.trim()) {
      const ts = Date.now();
      clientChunks.push({
        id: `partial-${String(ts)}`,
        sequence: 10_000_000 + clientChunks.length,
        tStartMs: ts - 400,
        tEndMs: ts,
        speaker: null,
        speakerRole: "UNKNOWN",
        audioSource: undefined,
        prosodyEnergy: null,
        prosodyPauseRatio: null,
        prosodyVoicedMs: null,
        prosodySnrDb: null,
        prosodyQualityPass: null,
        prosodyToneWeightsEnabled: null,
        prosodyConfidencePenalty: null,
        prosodyClientEnergy: null,
        prosodyClientStress: null,
        prosodyClientCertainty: null,
        text: body.partialText.trim(),
        confidence: 0.55,
      });
    }

    const mergedChunks = mergeChunks(storedChunks, clientChunks).slice(-180);
    const chunkBudgeted = mergedChunks.slice(-120);
    const redactedChunks = redactChunks(chunkBudgeted);
    const deltaChunks = redactedChunks.slice(-ANALYSIS_MAX_DELTA_UTTERANCES);

    const existingMemory = meetingMemoryStore.get(sessionId);
    const nowTs = Date.now();
    const shouldRefreshMemory =
      !existingMemory || nowTs - existingMemory.updatedAtMs >= 60_000;
    const meetingMemory = shouldRefreshMemory
      ? (existingMemory?.memory ?? emptyMeetingMemory())
      : existingMemory.memory;

    const analysisChunks = body.useHeuristics
      ? deltaChunks
      : deltaChunks.map((chunk) => ({
          ...chunk,
          prosodyEnergy: null,
          prosodyPauseRatio: null,
          prosodyVoicedMs: null,
          prosodySnrDb: null,
          prosodyQualityPass: null,
          prosodyToneWeightsEnabled: null,
          prosodyConfidencePenalty: null,
          prosodyClientEnergy: null,
          prosodyClientStress: null,
          prosodyClientCertainty: null,
        }));

    const heuristic = buildHeuristicLiveAnalysis({
      meetingId: sessionId,
      chunks: analysisChunks,
      useHeuristics: body.useHeuristics,
      sensitivity: body.sensitivity,
      coachingAggressiveness: body.coachingAggressiveness,
    });

    let coach = heuristic.coach;
    let insights = heuristic.insights;
    let summary = heuristic.summary;

    const cached = coachCache.get(sessionId);
    const withinCooldown =
      cached && Date.now() - cached.updatedAtMs < 8_000 && mode === "deep";

    if (withinCooldown) {
      coach = cached.coach;
      insights = cached.insights;
      summary = cached.summary;
    } else if (!body.privacyMode && mode === "deep") {
      const refined = await refineCoachWithGroq({
        mode,
        meetingId: sessionId,
        chunks: deltaChunks,
        meetingMemory,
        baseCoach: coach,
        baseInsights: insights,
        baseSummary: summary,
        sensitivity: body.sensitivity,
        coachingAggressiveness: body.coachingAggressiveness,
      });
      if (refined) {
        coach = refined.coach;
        insights = refined.insights;
        summary = refined.summary;
      }
      coachCache.set(sessionId, {
        updatedAtMs: Date.now(),
        coach,
        insights,
        summary,
      });
    }

    meetingMemoryStore.set(sessionId, {
      updatedAtMs: nowTs,
      memory: mergeMeetingMemory({
        current: meetingMemory,
        summary,
        insights,
        painPoints: coach.painPoints,
      }),
    });

    const response: LiveAnalysisResponse = {
      meetingId: sessionId,
      streamStatus: "live",
      latencyMs: Date.now() - startTs,
      mode,
      metrics: heuristic.metrics,
      coach: mode === "deep" ? coach : null,
      insights: mode === "deep" ? insights : [],
      summary,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("POST /api/meetings/:sessionId/live-analysis error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
