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

const requestSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["light", "deep"]).default("light"),
  privacyMode: z.boolean().optional().default(false),
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
        speakerRole: z.enum(["SALES", "CLIENT", "UNKNOWN"]).optional(),
        audioSource: z
          .enum(["microphone", "systemAudio", "tabAudio"])
          .optional(),
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
    .slice(-24)
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
    "Return strict JSON only with keys: nextBestSay, nextQuestions, doDont, insights, summary.",
    "Each suggestion must be short and actionable and include evidenceSnippets.",
    "Summary should be concise and executive-friendly for the sales rep.",
    `Sensitivity: ${String(args.sensitivity)}/100.`,
    `CoachingAggressiveness: ${String(args.coachingAggressiveness)}/100.`,
    "",
    "Transcript:",
    transcriptPreview,
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
        text: body.partialText.trim(),
        confidence: 0.55,
      });
    }

    const mergedChunks = mergeChunks(storedChunks, clientChunks).slice(-180);
    const heuristic = buildHeuristicLiveAnalysis({
      meetingId: sessionId,
      chunks: mergedChunks,
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
        chunks: mergedChunks,
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
