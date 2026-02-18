import {
  LIVE_ANALYSIS_RISK_FLAGS,
  LIVE_ANALYSIS_TOPICS,
  type LiveAnalysisAudioSource,
  type LiveAnalysisCallSummary,
  type LiveAnalysisChunkInput,
  type LiveAnalysisCoachDoDont,
  type LiveAnalysisCoachPayload,
  type LiveAnalysisCoachQuestion,
  type LiveAnalysisQuestionFollowUp,
  type LiveAnalysisCoachSuggestion,
  type LiveAnalysisEvidenceSnippet,
  type LiveAnalysisInsight,
  type LiveAnalysisMetrics,
  type LiveAnalysisPainPoint,
  type LiveAnalysisPainPointCategory,
  type LiveAnalysisRiskFlag,
  type LiveAnalysisSpeakerRole,
  type LiveAnalysisTopic,
} from "@/features/capture/live-analysis/types";

interface BuildAnalysisOptions {
  meetingId: string;
  chunks: LiveAnalysisChunkInput[];
  useHeuristics?: boolean;
  sensitivity: number;
  coachingAggressiveness: number;
  nowMs?: number;
}

interface NormalizedUtterance {
  id: string;
  tStartMs: number;
  tEndMs: number;
  speaker: string | null;
  speakerRole: LiveAnalysisSpeakerRole;
  audioSource?: LiveAnalysisAudioSource;
  prosodyEnergy?: number | null;
  prosodyPauseRatio?: number | null;
  prosodyVoicedMs?: number | null;
  prosodySnrDb?: number | null;
  text: string;
  confidence: number;
  words: number;
}

interface StakeholderSignal {
  speaker: string;
  valence: number;
  wordShare: number;
  riskHits: number;
  confidence: number;
  evidenceSnippets: LiveAnalysisEvidenceSnippet[];
}

interface StakeholderSignals {
  champion: StakeholderSignal | null;
  skeptic: StakeholderSignal | null;
}

interface HeuristicAnalysisResult {
  metrics: LiveAnalysisMetrics;
  coach: LiveAnalysisCoachPayload;
  insights: LiveAnalysisInsight[];
  summary: LiveAnalysisCallSummary;
}

const TOPIC_KEYWORDS: Record<LiveAnalysisTopic, string[]> = {
  needProblem: ["problem", "pain", "challenge", "issue", "need"],
  budget: ["budget", "cost", "price", "pricing", "spend", "roi"],
  timeline: ["timeline", "quarter", "month", "deadline", "by when"],
  decisionMaker: ["decision maker", "approver", "sign off", "stakeholder"],
  alternativesCompetitors: [
    "competitor",
    "alternative",
    "other vendor",
    "compare",
  ],
  technicalFit: ["integration", "api", "technical", "implementation", "fit"],
  securityCompliance: ["security", "compliance", "soc2", "gdpr", "privacy"],
  procurement: ["procurement", "legal", "msa", "purchase order", "vendor form"],
  nextSteps: ["next step", "follow up", "pilot", "trial", "schedule"],
};

const RISK_KEYWORDS: Record<LiveAnalysisRiskFlag, string[]> = {
  priceObjection: ["too expensive", "price", "cost", "budget", "cheap"],
  timingObjection: ["not now", "later", "next quarter", "timing", "wait"],
  trustConcern: ["trust", "reliable", "proven", "reference", "risk"],
  featureGap: ["missing", "doesn't support", "feature gap", "lack"],
  securityConcern: ["security", "compliance", "soc2", "data breach"],
  integrationConcern: ["integration", "api", "migration", "compatibility"],
  competitorMention: ["competitor", "alternative", "vs", "already using"],
  confusion: ["confused", "not clear", "unclear", "don't understand"],
  frustration: ["frustrated", "annoyed", "not happy", "painful"],
  lowEngagement: ["maybe", "not sure", "fine", "okay", "whatever"],
  scopeMismatch: ["not relevant", "different use case", "out of scope"],
};

const POSITIVE_WORDS = new Set([
  "good",
  "great",
  "excellent",
  "love",
  "helpful",
  "useful",
  "clear",
  "yes",
  "works",
  "perfect",
  "valuable",
  "happy",
]);

const NEGATIVE_WORDS = new Set([
  "bad",
  "issue",
  "problem",
  "expensive",
  "difficult",
  "hard",
  "confused",
  "frustrated",
  "no",
  "can't",
  "cannot",
  "risk",
  "concern",
]);

const CERTAINTY_WORDS = new Set([
  "definitely",
  "certainly",
  "exactly",
  "clear",
  "sure",
  "will",
]);

const HEDGE_WORDS = new Set([
  "maybe",
  "perhaps",
  "might",
  "possibly",
  "kind of",
  "sort of",
  "not sure",
]);

const SALES_CUE_PHRASES = [
  "let me",
  "we help",
  "our platform",
  "our product",
  "we can",
  "next step",
  "timeline",
  "budget",
  "how are you",
  "what would",
] as const;

const CLIENT_CUE_PHRASES = [
  "we need",
  "our team",
  "we use",
  "we are using",
  "concern",
  "too expensive",
  "not now",
  "not sure",
  "doesn't support",
  "issue",
] as const;

const AUDIO_SOURCE_ROLE_MAP: Partial<
  Record<LiveAnalysisAudioSource, LiveAnalysisSpeakerRole>
> = {
  microphone: "SALES",
  systemAudio: "CLIENT",
  tabAudio: "CLIENT",
};

const RISK_KEYWORDS_FLAT = [...new Set(Object.values(RISK_KEYWORDS).flat())];

const TOPIC_RECOVERY_PROMPTS: Record<LiveAnalysisTopic, string> = {
  needProblem:
    "Reconfirm the core business problem and impact in client terms.",
  budget: "Align budget expectations to concrete ROI and rollout scope.",
  timeline: "Pin down timeline blockers and propose a phased start date.",
  decisionMaker:
    "Confirm decision owners and sign-off path before ending the call.",
  alternativesCompetitors:
    "Ask how alternatives are being scored and position your differentiator.",
  technicalFit:
    "Clarify integration and technical fit with one concrete example.",
  securityCompliance:
    "Address security/compliance concerns with proof and process.",
  procurement: "Surface procurement/legal steps and next ownership.",
  nextSteps: "Lock clear next steps with owner and date.",
};

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "it",
  "this",
  "that",
  "we",
  "you",
  "our",
  "your",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "i",
  "me",
  "my",
  "us",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function makeId(prefix: string, seed: string, index: number): string {
  const cleaned = seed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  return `${prefix}-${cleaned || "item"}-${String(index)}`;
}

function scoreSalesSignal(text: string): number {
  const normalized = text.toLowerCase();
  let score = 0;
  score += keywordHits(normalized, SALES_CUE_PHRASES) * 0.8;
  score += (normalized.match(/\?/g) ?? []).length * 0.35;
  if (/\b(let me|we can|i can|i'll|i will)\b/.test(normalized)) {
    score += 0.5;
  }
  return score;
}

function scoreClientSignal(text: string): number {
  const normalized = text.toLowerCase();
  let score = 0;
  score += keywordHits(normalized, CLIENT_CUE_PHRASES) * 0.7;
  score += keywordHits(normalized, RISK_KEYWORDS_FLAT) * 0.35;
  if (/\bwe need|our team|our process|our budget\b/.test(normalized)) {
    score += 0.45;
  }
  return score;
}

function inferSalesSpeaker(chunks: LiveAnalysisChunkInput[]): string | null {
  const explicitSales = chunks.find(
    (chunk) => chunk.speaker && chunk.speakerRole === "SALES",
  )?.speaker;
  if (explicitSales) return explicitSales;

  const sourceMappedSales = chunks.find(
    (chunk) => chunk.speaker && chunk.audioSource === "microphone",
  )?.speaker;
  if (sourceMappedSales) return sourceMappedSales;

  for (const chunk of chunks) {
    if (!chunk.speaker) continue;
    if (/(speaker\s*1|you|sales|me)/i.test(chunk.speaker)) {
      return chunk.speaker;
    }
  }

  const scoreBySpeaker = new Map<string, number>();
  for (const chunk of chunks) {
    if (!chunk.speaker) continue;
    let score = scoreBySpeaker.get(chunk.speaker) ?? 0;
    if (chunk.speakerRole === "SALES") score += 2;
    if (chunk.speakerRole === "CLIENT") score -= 1;
    if (
      chunk.audioSource &&
      AUDIO_SOURCE_ROLE_MAP[chunk.audioSource] === "SALES"
    ) {
      score += 1.8;
    }
    if (
      chunk.audioSource &&
      AUDIO_SOURCE_ROLE_MAP[chunk.audioSource] === "CLIENT"
    ) {
      score -= 1.2;
    }
    score +=
      scoreSalesSignal(chunk.text) - scoreClientSignal(chunk.text) * 0.65;
    scoreBySpeaker.set(chunk.speaker, score);
  }

  const rankedSpeakers = [...scoreBySpeaker.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const [bestSpeaker, bestScore] = rankedSpeakers[0] ?? [];
  const secondBestScore = rankedSpeakers[1]?.[1] ?? -Infinity;
  if (
    bestSpeaker &&
    typeof bestScore === "number" &&
    bestScore > 0.75 &&
    bestScore - secondBestScore > 0.35
  ) {
    return bestSpeaker;
  }

  return chunks.find((chunk) => chunk.speaker)?.speaker ?? null;
}

function assignRole(
  chunk: LiveAnalysisChunkInput,
  salesSpeaker: string | null,
): LiveAnalysisSpeakerRole {
  if (chunk.speakerRole) return chunk.speakerRole;

  if (chunk.audioSource && AUDIO_SOURCE_ROLE_MAP[chunk.audioSource]) {
    return AUDIO_SOURCE_ROLE_MAP[chunk.audioSource]!;
  }

  if (chunk.speaker && salesSpeaker && chunk.speaker === salesSpeaker) {
    return "SALES";
  }

  if (chunk.speaker) {
    return "CLIENT";
  }

  const salesScore = scoreSalesSignal(chunk.text);
  const clientScore = scoreClientSignal(chunk.text);
  if (salesScore - clientScore >= 0.9) {
    return "SALES";
  }
  if (clientScore - salesScore >= 0.6) {
    return "CLIENT";
  }

  return "UNKNOWN";
}

function inferUnknownRoleFromContext(
  utterances: NormalizedUtterance[],
  index: number,
): LiveAnalysisSpeakerRole {
  const current = utterances[index];
  if (!current) return "UNKNOWN";

  const prev = index > 0 ? utterances[index - 1] : null;
  const next = index < utterances.length - 1 ? utterances[index + 1] : null;

  if (
    prev &&
    next &&
    prev.speakerRole !== "UNKNOWN" &&
    prev.speakerRole === next.speakerRole
  ) {
    return prev.speakerRole;
  }

  if (prev && prev.speakerRole !== "UNKNOWN" && prev.text.includes("?")) {
    return prev.speakerRole === "SALES" ? "CLIENT" : "SALES";
  }

  if (next && next.speakerRole !== "UNKNOWN" && current.text.includes("?")) {
    return next.speakerRole === "SALES" ? "CLIENT" : "SALES";
  }

  const salesScore = scoreSalesSignal(current.text);
  const clientScore = scoreClientSignal(current.text);
  if (salesScore - clientScore >= 0.7) return "SALES";
  if (clientScore - salesScore >= 0.5) return "CLIENT";

  return "UNKNOWN";
}

function dedupeAndNormalize(
  chunks: LiveAnalysisChunkInput[],
): NormalizedUtterance[] {
  const salesSpeaker = inferSalesSpeaker(chunks);
  const seen = new Set<string>();

  const normalized: NormalizedUtterance[] = [];
  chunks.forEach((chunk, index) => {
    const text = normalizeText(chunk.text);
    if (!text) return;

    const key =
      chunk.id ??
      `${String(chunk.sequence ?? -1)}:${String(chunk.tStartMs)}:${String(chunk.tEndMs)}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);

    const confidence = clamp(chunk.confidence ?? 0.7, 0, 1);
    const words = toWords(text).length;
    normalized.push({
      id: chunk.id ?? `utt-${String(index)}`,
      tStartMs: Math.max(0, chunk.tStartMs),
      tEndMs: Math.max(chunk.tStartMs + 1, chunk.tEndMs),
      speaker: chunk.speaker,
      speakerRole: assignRole(chunk, salesSpeaker),
      audioSource: chunk.audioSource,
      prosodyEnergy: chunk.prosodyEnergy ?? null,
      prosodyPauseRatio: chunk.prosodyPauseRatio ?? null,
      prosodyVoicedMs: chunk.prosodyVoicedMs ?? null,
      prosodySnrDb: chunk.prosodySnrDb ?? null,
      text,
      confidence,
      words,
    });
  });

  normalized.sort((a, b) => {
    if (a.tStartMs !== b.tStartMs) return a.tStartMs - b.tStartMs;
    return a.tEndMs - b.tEndMs;
  });

  return normalized.map((utterance, index) => {
    if (utterance.speakerRole !== "UNKNOWN") return utterance;
    const inferredRole = inferUnknownRoleFromContext(normalized, index);
    if (inferredRole === "UNKNOWN") return utterance;
    return {
      ...utterance,
      speakerRole: inferredRole,
      speaker:
        utterance.speaker ??
        (inferredRole === "SALES" ? "Sales (inferred)" : "Client (inferred)"),
    };
  });
}

function keywordHits(text: string, keywords: readonly string[]): number {
  const lowercase = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    return count + (lowercase.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
}

function buildEvidence(
  chunks: NormalizedUtterance[],
  predicate: (chunk: NormalizedUtterance) => boolean,
  limit = 2,
): LiveAnalysisEvidenceSnippet[] {
  return chunks
    .filter(predicate)
    .slice(-limit)
    .map((chunk) => ({
      utteranceId: chunk.id,
      speakerRole: chunk.speakerRole,
      tsStartMs: chunk.tStartMs,
      tsEndMs: chunk.tEndMs,
      text: chunk.text.slice(0, 280),
    }));
}

function sentimentStats(text: string): {
  positiveHits: number;
  negativeHits: number;
  certaintyHits: number;
  hedgeHits: number;
  valence: number;
} {
  let positiveHits = 0;
  let negativeHits = 0;
  let certaintyHits = 0;
  let hedgeHits = 0;

  toWords(text).forEach((token) => {
    if (POSITIVE_WORDS.has(token)) positiveHits += 1;
    if (NEGATIVE_WORDS.has(token)) negativeHits += 1;
    if (CERTAINTY_WORDS.has(token)) certaintyHits += 1;
    if (HEDGE_WORDS.has(token)) hedgeHits += 1;
  });

  const valence =
    (positiveHits - negativeHits) / Math.max(3, positiveHits + negativeHits);

  return {
    positiveHits,
    negativeHits,
    certaintyHits,
    hedgeHits,
    valence,
  };
}

function computeStakeholderSignals(
  clientUtterances: NormalizedUtterance[],
  totalClientWords: number,
): StakeholderSignals {
  const bySpeaker = new Map<string, NormalizedUtterance[]>();
  clientUtterances.forEach((utterance) => {
    if (!utterance.speaker) return;
    const existing = bySpeaker.get(utterance.speaker) ?? [];
    existing.push(utterance);
    bySpeaker.set(utterance.speaker, existing);
  });

  const signals: StakeholderSignal[] = [];
  bySpeaker.forEach((utterances, speaker) => {
    const words = utterances.reduce((sum, item) => sum + item.words, 0);
    if (words < 8) return;

    const text = utterances.map((item) => item.text).join(" ");
    const stats = sentimentStats(text);
    const riskHits = keywordHits(text, RISK_KEYWORDS_FLAT);
    const wordShare = words / Math.max(1, totalClientWords);

    const confidence = clamp(
      0.42 + wordShare * 0.38 + Math.min(0.15, riskHits * 0.03),
      0,
      0.95,
    );

    signals.push({
      speaker,
      valence: stats.valence,
      wordShare,
      riskHits,
      confidence: Number(confidence.toFixed(2)),
      evidenceSnippets: buildEvidence(utterances, () => true, 2),
    });
  });

  if (signals.length === 0) {
    return { champion: null, skeptic: null };
  }

  const champion =
    [...signals]
      .filter((signal) => signal.valence >= 0.18 && signal.wordShare >= 0.15)
      .sort((a, b) => b.valence - a.valence || b.wordShare - a.wordShare)[0] ??
    null;

  const skepticCandidates = [...signals]
    .filter(
      (signal) =>
        (signal.valence <= -0.16 || signal.riskHits >= 2) &&
        signal.wordShare >= 0.15,
    )
    .sort((a, b) => a.valence - b.valence || b.wordShare - a.wordShare);

  const skeptic =
    skepticCandidates.find(
      (signal) => !champion || signal.speaker !== champion.speaker,
    ) ??
    skepticCandidates[0] ??
    null;

  return { champion, skeptic };
}

function computeTopicCoverage(
  utterances: NormalizedUtterance[],
): LiveAnalysisMetrics["topicCoverage"] {
  const fullText = utterances
    .map((chunk) => chunk.text)
    .join(" ")
    .toLowerCase();
  const checkedTopics: LiveAnalysisTopic[] = [];
  const confidenceByTopic: Record<LiveAnalysisTopic, number> = {} as Record<
    LiveAnalysisTopic,
    number
  >;

  for (const topic of LIVE_ANALYSIS_TOPICS) {
    const hits = keywordHits(fullText, TOPIC_KEYWORDS[topic]);
    const confidence = clamp(hits / 2, 0, 1);
    confidenceByTopic[topic] = Number(confidence.toFixed(2));
    if (confidence >= 0.45) {
      checkedTopics.push(topic);
    }
  }

  return { checkedTopics, confidenceByTopic };
}

function computeRiskFlags(
  clientText: string,
  clientEngagement: number,
): LiveAnalysisRiskFlag[] {
  const flags = new Set<LiveAnalysisRiskFlag>();
  const text = clientText.toLowerCase();
  for (const flag of LIVE_ANALYSIS_RISK_FLAGS) {
    const hits = keywordHits(text, RISK_KEYWORDS[flag]);
    if (hits > 0) flags.add(flag);
  }

  if (clientEngagement < 0.35) {
    flags.add("lowEngagement");
  }

  return [...flags];
}

function severityForRisk(
  flag: LiveAnalysisRiskFlag,
): LiveAnalysisInsight["severity"] {
  if (
    flag === "securityConcern" ||
    flag === "trustConcern" ||
    flag === "scopeMismatch"
  ) {
    return "high";
  }
  if (
    flag === "priceObjection" ||
    flag === "integrationConcern" ||
    flag === "featureGap"
  ) {
    return "medium";
  }
  return "low";
}

function insightTypeForRisk(flag: LiveAnalysisRiskFlag): "objection" | "risk" {
  switch (flag) {
    case "priceObjection":
    case "timingObjection":
    case "trustConcern":
    case "featureGap":
    case "securityConcern":
    case "integrationConcern":
    case "competitorMention":
      return "objection";
    default:
      return "risk";
  }
}

function labelForRisk(flag: LiveAnalysisRiskFlag): string {
  switch (flag) {
    case "priceObjection":
      return "Price objection detected";
    case "timingObjection":
      return "Timing objection detected";
    case "trustConcern":
      return "Trust concern detected";
    case "featureGap":
      return "Feature gap concern detected";
    case "securityConcern":
      return "Security concern detected";
    case "integrationConcern":
      return "Integration concern detected";
    case "competitorMention":
      return "Competitor mention detected";
    case "confusion":
      return "Client confusion signal";
    case "frustration":
      return "Client frustration signal";
    case "lowEngagement":
      return "Low engagement risk";
    case "scopeMismatch":
      return "Scope mismatch risk";
  }
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

function topicForRisk(risk: LiveAnalysisRiskFlag): LiveAnalysisTopic | null {
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

function painPointCategoryForRisk(
  risk: LiveAnalysisRiskFlag,
): LiveAnalysisPainPointCategory {
  switch (risk) {
    case "priceObjection":
      return "cost";
    case "timingObjection":
      return "time";
    case "integrationConcern":
      return "integration";
    case "securityConcern":
      return "compliance";
    case "trustConcern":
      return "trust";
    case "featureGap":
      return "usability";
    case "lowEngagement":
      return "other";
    case "scopeMismatch":
      return "risk";
    case "competitorMention":
      return "support";
    case "confusion":
      return "usability";
    case "frustration":
      return "risk";
  }
}

const PAIN_POINT_DETAIL_BY_RISK: Partial<Record<LiveAnalysisRiskFlag, string>> =
  {
    priceObjection: "Client is signaling pricing pressure and budget concern.",
    timingObjection: "Client is delaying urgency or timeline commitment.",
    integrationConcern: "Integration complexity is blocking confidence.",
    securityConcern: "Security/compliance concerns need concrete proof.",
    trustConcern: "Trust signals are weak and require validation.",
    featureGap: "Perceived product capability gap is reducing fit confidence.",
    scopeMismatch: "Use case appears misaligned with current value framing.",
    lowEngagement: "Client participation dropped and buying intent is unclear.",
  };

function buildPainPoints(
  riskFlags: LiveAnalysisRiskFlag[],
  evidence: LiveAnalysisEvidenceSnippet[],
): LiveAnalysisPainPoint[] {
  const evidenceUtteranceIds = evidence
    .map((item) => item.utteranceId)
    .slice(0, 4);

  return riskFlags.slice(0, 5).map((flag, index) => {
    const detail =
      PAIN_POINT_DETAIL_BY_RISK[flag] ??
      `${labelForRisk(flag)} in current conversation window.`;

    return {
      title: labelForRisk(flag),
      detail,
      category: painPointCategoryForRisk(flag),
      confidence: Number(clamp(0.62 - index * 0.03, 0.45, 0.8).toFixed(2)),
      evidenceUtteranceIds,
    };
  });
}

function computeCoach(
  meetingId: string,
  nowMs: number,
  riskFlags: LiveAnalysisRiskFlag[],
  missingTopics: LiveAnalysisTopic[],
  evidence: LiveAnalysisEvidenceSnippet[],
  stakeholderSignals: StakeholderSignals,
  coachingAggressiveness: number,
): LiveAnalysisCoachPayload {
  const evidenceTexts = evidence.map((item) => item.text.slice(0, 120));
  const weight = clamp(coachingAggressiveness / 100, 0, 1);

  const nextBestSay: LiveAnalysisCoachSuggestion[] = [];
  const nextQuestions: LiveAnalysisCoachQuestion[] = [];
  const doDont: LiveAnalysisCoachDoDont[] = [];
  const painPoints = buildPainPoints(riskFlags, evidence);

  if (riskFlags.includes("priceObjection")) {
    nextBestSay.push({
      suggestionId: makeId("say", "price", 1),
      text: "Acknowledge price, then anchor to one measurable outcome and payback timing.",
      intent: "addressObjection",
      confidence: 0.7 + weight * 0.15,
      evidenceSnippets: evidenceTexts,
    });
    nextQuestions.push({
      questionId: makeId("ask", "price", 1),
      text: "What budget range did you already allocate for solving this problem?",
      intent: "budget",
      confidence: 0.7,
      evidenceSnippets: evidenceTexts,
    });
  }

  if (riskFlags.includes("timingObjection")) {
    nextBestSay.push({
      suggestionId: makeId("say", "timing", 1),
      text: "Lower perceived effort: suggest a small pilot with clear success criteria.",
      intent: "clarify",
      confidence: 0.68 + weight * 0.18,
      evidenceSnippets: evidenceTexts,
    });
    nextQuestions.push({
      questionId: makeId("ask", "timing", 1),
      text: "What milestone has to happen before this becomes a priority?",
      intent: "timeline",
      confidence: 0.71,
      evidenceSnippets: evidenceTexts,
    });
  }

  if (
    riskFlags.includes("trustConcern") ||
    riskFlags.includes("securityConcern")
  ) {
    nextBestSay.push({
      suggestionId: makeId("say", "trust", 1),
      text: "Rebuild trust with proof: similar customer result, security posture, rollout plan.",
      intent: "valueReinforce",
      confidence: 0.75,
      evidenceSnippets: evidenceTexts,
    });
    nextQuestions.push({
      questionId: makeId("ask", "trust", 1),
      text: "Which risk would you need us to de-risk first to move forward?",
      intent: "risk",
      confidence: 0.74,
      evidenceSnippets: evidenceTexts,
    });
  }

  if (nextBestSay.length === 0) {
    nextBestSay.push({
      suggestionId: makeId("say", "generic", 1),
      text: "Mirror the client goal in one sentence, then confirm before pitching further.",
      intent: "clarify",
      confidence: 0.66,
      evidenceSnippets: evidenceTexts,
    });
  }

  if (nextQuestions.length === 0) {
    const missing = missingTopics[0];
    nextQuestions.push({
      questionId: makeId("ask", missing ?? "discovery", 1),
      text:
        missing === "budget"
          ? "How are you currently budgeting for this initiative?"
          : missing === "timeline"
            ? "What timeline are you targeting for a decision?"
            : missing === "decisionMaker"
              ? "Who else will be involved in the final decision?"
              : "What outcome matters most for this conversation today?",
      intent:
        missing === "budget"
          ? "budget"
          : missing === "timeline"
            ? "timeline"
            : missing === "decisionMaker"
              ? "dm"
              : "discovery",
      confidence: 0.64,
      evidenceSnippets: evidenceTexts,
    });
  }

  if (stakeholderSignals.skeptic) {
    const skeptic = stakeholderSignals.skeptic;
    nextQuestions.unshift({
      questionId: makeId("ask", "skeptic-risk", 1),
      text: `What must be true for ${skeptic.speaker} to feel safe moving forward?`,
      intent: "risk",
      confidence: clamp(0.69 + weight * 0.1, 0, 1),
      evidenceSnippets: skeptic.evidenceSnippets.map((item) =>
        item.text.slice(0, 120),
      ),
    });
  }

  if (stakeholderSignals.champion && stakeholderSignals.skeptic) {
    nextBestSay.unshift({
      suggestionId: makeId("say", "champion-skeptic", 1),
      text: `Align ${stakeholderSignals.champion.speaker} and ${stakeholderSignals.skeptic.speaker} on one shared success metric.`,
      intent: "rapport",
      confidence: clamp(0.7 + weight * 0.12, 0, 1),
      evidenceSnippets: [
        ...stakeholderSignals.champion.evidenceSnippets,
        ...stakeholderSignals.skeptic.evidenceSnippets,
      ]
        .slice(0, 3)
        .map((item) => item.text.slice(0, 120)),
    });
  }

  doDont.push(
    {
      id: makeId("dodont", "do-confirm", 1),
      type: "do",
      text: "Do confirm understanding after each objection before responding.",
      confidence: 0.77,
      evidenceSnippets: evidenceTexts,
    },
    {
      id: makeId("dodont", "dont-overload", 1),
      type: "dont",
      text: "Don't stack multiple claims without tying them to the client's stated need.",
      confidence: 0.75,
      evidenceSnippets: evidenceTexts,
    },
  );

  return {
    meetingId,
    generatedAtMs: nowMs,
    nextBestSay: nextBestSay.slice(0, 3).map((item) => ({
      ...item,
      confidence: Number(clamp(item.confidence, 0, 1).toFixed(2)),
    })),
    nextQuestions: nextQuestions.slice(0, 3).map((item) => ({
      ...item,
      confidence: Number(clamp(item.confidence, 0, 1).toFixed(2)),
    })),
    doDont: doDont.slice(0, 4).map((item) => ({
      ...item,
      confidence: Number(clamp(item.confidence, 0, 1).toFixed(2)),
    })),
    painPoints,
  };
}

function computeInsights(
  meetingId: string,
  nowMs: number,
  riskFlags: LiveAnalysisRiskFlag[],
  topicCoverage: LiveAnalysisMetrics["topicCoverage"],
  evidence: LiveAnalysisEvidenceSnippet[],
  stakeholderSignals: StakeholderSignals,
  clientValence: number,
  clientEngagement: number,
): LiveAnalysisInsight[] {
  const insights: LiveAnalysisInsight[] = [];

  riskFlags.forEach((flag, index) => {
    insights.push({
      meetingId,
      insightId: makeId("risk", flag, index + 1),
      timestampMs: nowMs,
      type: insightTypeForRisk(flag),
      severity: severityForRisk(flag),
      title: labelForRisk(flag),
      detail: `Signal from recent client language indicates ${flag}.`,
      confidence: 0.7,
      evidenceSnippets: evidence,
    });
  });

  if (clientValence > 0.25 && clientEngagement > 0.55) {
    insights.push({
      meetingId,
      insightId: makeId("positive", "engagement", 1),
      timestampMs: nowMs,
      type: "positiveSignal",
      severity: "low",
      title: "Positive momentum",
      detail: "Client sentiment and engagement are currently favorable.",
      confidence: 0.68,
      evidenceSnippets: evidence,
    });
  }

  const missingCritical = ["budget", "timeline", "decisionMaker"].filter(
    (topic) =>
      !topicCoverage.checkedTopics.includes(topic as LiveAnalysisTopic),
  );
  if (missingCritical.length > 0) {
    insights.push({
      meetingId,
      insightId: makeId("topic-gap", missingCritical.join("-"), 1),
      timestampMs: nowMs,
      type: "topic",
      severity: "medium",
      title: "Coverage gap",
      detail: `Key topics still open: ${missingCritical.join(", ")}.`,
      confidence: 0.66,
      evidenceSnippets: evidence,
    });
  }

  if (stakeholderSignals.champion) {
    insights.push({
      meetingId,
      insightId: makeId("champion", stakeholderSignals.champion.speaker, 1),
      timestampMs: nowMs,
      type: "positiveSignal",
      severity: "low",
      title: "Potential champion identified",
      detail: `${stakeholderSignals.champion.speaker} shows supportive language and active participation.`,
      confidence: stakeholderSignals.champion.confidence,
      evidenceSnippets: stakeholderSignals.champion.evidenceSnippets,
    });
  }

  if (stakeholderSignals.skeptic) {
    insights.push({
      meetingId,
      insightId: makeId("skeptic", stakeholderSignals.skeptic.speaker, 1),
      timestampMs: nowMs,
      type: "risk",
      severity:
        stakeholderSignals.skeptic.valence < -0.3 ||
        stakeholderSignals.skeptic.riskHits >= 3
          ? "high"
          : "medium",
      title: "Potential skeptic identified",
      detail: `${stakeholderSignals.skeptic.speaker} is signaling objections that could stall buying momentum.`,
      confidence: stakeholderSignals.skeptic.confidence,
      evidenceSnippets: stakeholderSignals.skeptic.evidenceSnippets,
    });
  }

  return insights.slice(0, 10).map((insight) => ({
    ...insight,
    confidence: Number(clamp(insight.confidence, 0, 1).toFixed(2)),
  }));
}

function contentWords(text: string): string[] {
  return toWords(text).filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token),
  );
}

function keywordOverlapScore(a: string, b: string): number {
  const aWords = new Set(contentWords(a));
  const bWords = new Set(contentWords(b));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let matches = 0;
  for (const word of aWords) {
    if (bWords.has(word)) matches += 1;
  }
  return matches / Math.max(1, Math.min(aWords.size, bWords.size));
}

function computeQuestionFollowUps(
  utterances: NormalizedUtterance[],
): LiveAnalysisQuestionFollowUp[] {
  const followUps: LiveAnalysisQuestionFollowUp[] = [];

  for (let i = 0; i < utterances.length; i++) {
    const current = utterances[i];
    if (!current || current.speakerRole !== "CLIENT") continue;
    if (!current.text.includes("?")) continue;

    const nextTurns = utterances.slice(i + 1, i + 7);
    const salesReply = nextTurns.find(
      (turn) => turn.speakerRole === "SALES" && turn.tStartMs >= current.tEndMs,
    );

    const tooLate =
      !salesReply || salesReply.tStartMs - current.tEndMs > 25_000;

    let status: LiveAnalysisQuestionFollowUp["status"] = "answered";
    let responseText: string | null = salesReply?.text ?? null;
    let suggestedRecovery =
      "Restate the question directly, then answer with one clear business outcome.";

    if (tooLate) {
      status = "missed";
      responseText = null;
      suggestedRecovery =
        "Acknowledge you missed the question, answer it directly, and confirm if that resolves the concern.";
    } else if (salesReply) {
      const replyWords = contentWords(salesReply.text).length;
      const overlap = keywordOverlapScore(current.text, salesReply.text);
      const deflectCue =
        /(later|circle back|offline|after this|not sure)/i.test(
          salesReply.text,
        );

      if (replyWords < 6 || overlap < 0.15 || deflectCue) {
        status = "weak";
        suggestedRecovery =
          "Give a direct answer first, then offer one proof point and ask for confirmation.";
      }
    }

    followUps.push({
      questionId: makeId("qfollow", current.id, followUps.length + 1),
      questionText: current.text.slice(0, 220),
      askedAtMs: current.tStartMs,
      status,
      responseText: responseText?.slice(0, 220) ?? null,
      suggestedRecovery,
    });
  }

  return followUps.slice(-8);
}

function computeCallSummary(args: {
  nowMs: number;
  metrics: LiveAnalysisMetrics;
  riskFlags: LiveAnalysisRiskFlag[];
  missingTopics: LiveAnalysisTopic[];
  questionFollowUps: LiveAnalysisQuestionFollowUp[];
  stakeholderSignals: StakeholderSignals;
}): LiveAnalysisCallSummary {
  const missedQuestions = args.questionFollowUps.filter(
    (item) => item.status === "missed",
  );
  const weakQuestions = args.questionFollowUps.filter(
    (item) => item.status === "weak",
  );

  const strengths: string[] = [];
  if (args.metrics.callHealth >= 72) {
    strengths.push("Overall call health stayed in a strong range.");
  }
  if (args.metrics.clientEngagement >= 0.58) {
    strengths.push("Client engagement was solid through most of the call.");
  }
  if (args.riskFlags.length <= 1) {
    strengths.push("Few critical objections surfaced.");
  }
  if (args.stakeholderSignals.champion) {
    strengths.push(
      `${args.stakeholderSignals.champion.speaker} appears supportive and can help internal buy-in.`,
    );
  }

  const misses: string[] = [];
  args.riskFlags.slice(0, 3).forEach((flag) => {
    misses.push(`Objection detected: ${labelForRisk(flag)}.`);
  });
  if (missedQuestions.length > 0) {
    misses.push(
      `${missedQuestions.length} client question(s) were not answered directly.`,
    );
  }
  if (weakQuestions.length > 0) {
    misses.push(
      `${weakQuestions.length} client question(s) received weak/indirect answers.`,
    );
  }
  if (args.missingTopics.length > 0) {
    misses.push(
      `Critical discovery gaps: ${args.missingTopics
        .slice(0, 3)
        .map((topic) => topicLabel(topic))
        .join(", ")}.`,
    );
  }

  const immediateActions: string[] = [];
  const topRiskTopic = args.riskFlags[0]
    ? topicForRisk(args.riskFlags[0])
    : null;
  if (topRiskTopic) {
    immediateActions.push(TOPIC_RECOVERY_PROMPTS[topRiskTopic]);
  }
  missedQuestions.slice(0, 2).forEach((question) => {
    immediateActions.push(`Close the loop on: "${question.questionText}"`);
  });
  if (immediateActions.length === 0) {
    const nextTopic = args.missingTopics[0];
    if (nextTopic) {
      immediateActions.push(TOPIC_RECOVERY_PROMPTS[nextTopic]);
    } else {
      immediateActions.push(
        "Summarize agreed value and lock a concrete next step with owner/date.",
      );
    }
  }

  const baseScore =
    args.metrics.callHealth -
    args.riskFlags.length * 6 -
    missedQuestions.length * 15 -
    weakQuestions.length * 8 +
    (args.stakeholderSignals.champion ? 4 : 0);
  const score = clamp(baseScore, 0, 100);

  const overallAssessment =
    score >= 70 ? "strong" : score >= 50 ? "mixed" : "atRisk";

  const headline =
    overallAssessment === "strong"
      ? "Call is trending well. Keep momentum and secure next steps."
      : overallAssessment === "mixed"
        ? "Mixed outcome. Resolve objections and close open client questions."
        : "At risk. Key concerns were unresolved and buying signals weakened.";

  return {
    updatedAtMs: args.nowMs,
    overallAssessment,
    headline,
    strengths: strengths.slice(0, 4),
    misses: misses.slice(0, 5),
    immediateActions: immediateActions.slice(0, 4),
    questionFollowUps: args.questionFollowUps,
  };
}

export function buildHeuristicLiveAnalysis({
  meetingId,
  chunks,
  useHeuristics = true,
  sensitivity,
  coachingAggressiveness,
  nowMs,
}: BuildAnalysisOptions): HeuristicAnalysisResult {
  const utterances = dedupeAndNormalize(chunks);
  const now = nowMs ?? utterances[utterances.length - 1]?.tEndMs ?? Date.now();
  const windowStart = Math.max(
    0,
    now - 120_000,
    utterances[0]?.tStartMs ?? now - 120_000,
  );
  const inWindow = utterances.filter((chunk) => chunk.tEndMs >= windowStart);
  const clientUtterances = inWindow.filter(
    (chunk) => chunk.speakerRole === "CLIENT",
  );
  const salesUtterances = inWindow.filter(
    (chunk) => chunk.speakerRole === "SALES",
  );

  const clientText = clientUtterances.map((chunk) => chunk.text).join(" ");
  const clientWords = clientUtterances.reduce(
    (sum, chunk) => sum + chunk.words,
    0,
  );
  const salesWords = salesUtterances.reduce(
    (sum, chunk) => sum + chunk.words,
    0,
  );
  const totalWords = Math.max(1, salesWords + clientWords);

  const sentimentTokens = toWords(clientText);
  let positiveHits = 0;
  let negativeHits = 0;
  let certaintyHits = 0;
  let hedgeHits = 0;
  sentimentTokens.forEach((token) => {
    if (POSITIVE_WORDS.has(token)) positiveHits += 1;
    if (NEGATIVE_WORDS.has(token)) negativeHits += 1;
    if (CERTAINTY_WORDS.has(token)) certaintyHits += 1;
    if (HEDGE_WORDS.has(token)) hedgeHits += 1;
  });

  const questionCount = (clientText.match(/\?/g) ?? []).length;
  const exclamationCount = (clientText.match(/!/g) ?? []).length;

  const baseValence =
    (positiveHits - negativeHits) / Math.max(3, positiveHits + negativeHits);
  const sensitivityAdjustment = (sensitivity - 50) / 300;
  const textValence = clamp(baseValence - sensitivityAdjustment, -1, 1);

  const clientTalkRatio = clientWords / totalWords;
  const turnScore = clamp(clientUtterances.length / 10, 0, 1);
  const questionScore = clamp(questionCount / 4, 0, 1);
  const balanceScore = 1 - Math.abs(0.5 - clientTalkRatio) * 1.5;
  const dynamicsEngagement = clamp(
    0.45 * turnScore + 0.3 * questionScore + 0.25 * balanceScore,
    0,
    1,
  );

  const topicCoverage = computeTopicCoverage(inWindow);
  const riskFlags = computeRiskFlags(clientText, dynamicsEngagement);
  const missingTopics = LIVE_ANALYSIS_TOPICS.filter(
    (topic) => !topicCoverage.checkedTopics.includes(topic),
  );
  const stakeholderSignals = computeStakeholderSignals(
    clientUtterances,
    clientWords,
  );

  const clientDurationMin = Math.max(
    0.5,
    clientUtterances.reduce(
      (sum, chunk) => sum + (chunk.tEndMs - chunk.tStartMs),
      0,
    ) / 60_000,
  );
  const salesDurationMin = Math.max(
    0.5,
    salesUtterances.reduce(
      (sum, chunk) => sum + (chunk.tEndMs - chunk.tStartMs),
      0,
    ) / 60_000,
  );

  let interruptionsCount = 0;
  for (let i = 1; i < inWindow.length; i++) {
    const current = inWindow[i]!;
    const previous = inWindow[i - 1]!;
    if (current.speakerRole === previous.speakerRole) continue;
    if (current.tStartMs - previous.tEndMs < 450) interruptionsCount += 1;
  }

  const talkDynamics: LiveAnalysisMetrics["talkDynamics"] = {
    talkRatioSalesPct: Number(
      clamp((salesWords / totalWords) * 100, 0, 100).toFixed(1),
    ),
    talkRatioClientPct: Number(
      clamp((clientWords / totalWords) * 100, 0, 100).toFixed(1),
    ),
    interruptionsCount,
    paceWpmSales: Number(
      clamp(salesWords / salesDurationMin, 0, 300).toFixed(0),
    ),
    paceWpmClient: Number(
      clamp(clientWords / clientDurationMin, 0, 300).toFixed(0),
    ),
  };

  const lexicalClientEnergy = clamp(
    0.2 + questionCount * 0.08 + exclamationCount * 0.1 + clientWords / 260,
    0,
    1,
  );
  const lexicalClientStress = clamp(
    negativeHits * 0.1 + riskFlags.length * 0.08,
    0,
    1,
  );
  const lexicalClientCertainty = clamp(
    (certaintyHits + 1) / Math.max(2, certaintyHits + hedgeHits + 2),
    0,
    1,
  );
  const averageAsrConfidence =
    inWindow.reduce((sum, chunk) => sum + chunk.confidence, 0) /
    Math.max(1, inWindow.length);

  const clientProsodyFrames = clientUtterances.filter(
    (chunk) =>
      chunk.prosodyEnergy !== null &&
      chunk.prosodyEnergy !== undefined &&
      chunk.prosodyPauseRatio !== null &&
      chunk.prosodyPauseRatio !== undefined,
  );
  const avgProsodyEnergy =
    clientProsodyFrames.reduce(
      (sum, chunk) => sum + (chunk.prosodyEnergy ?? 0),
      0,
    ) / Math.max(1, clientProsodyFrames.length);
  const avgProsodyPauseRatio =
    clientProsodyFrames.reduce(
      (sum, chunk) => sum + (chunk.prosodyPauseRatio ?? 0.5),
      0,
    ) / Math.max(1, clientProsodyFrames.length);
  const avgProsodyVoicedMs =
    clientProsodyFrames.reduce(
      (sum, chunk) => sum + (chunk.prosodyVoicedMs ?? 0),
      0,
    ) / Math.max(1, clientProsodyFrames.length);
  const avgProsodySnrDb =
    clientProsodyFrames.reduce(
      (sum, chunk) => sum + (chunk.prosodySnrDb ?? 0),
      0,
    ) / Math.max(1, clientProsodyFrames.length);

  const hasProsodyFrames = clientProsodyFrames.length >= 2;
  const prosodyQualityPass =
    useHeuristics &&
    hasProsodyFrames &&
    avgProsodyVoicedMs >= 800 &&
    avgProsodySnrDb >= 10 &&
    averageAsrConfidence >= 0.55;
  const toneConfidence = prosodyQualityPass
    ? clamp(0.62 + Math.min(0.3, clientProsodyFrames.length * 0.05), 0, 1)
    : clamp(0.2 + Math.min(0.18, clientUtterances.length * 0.02), 0, 0.5);

  const clientEnergy = prosodyQualityPass
    ? clamp(avgProsodyEnergy, 0, 1)
    : Number((lexicalClientEnergy * 0.75).toFixed(2));
  const clientStress = prosodyQualityPass
    ? clamp(
        avgProsodyPauseRatio * 0.45 +
          avgProsodyEnergy * 0.35 +
          clamp((20 - avgProsodySnrDb) / 20, 0, 1) * 0.2,
        0,
        1,
      )
    : Number((lexicalClientStress * 0.85).toFixed(2));
  const clientCertainty = prosodyQualityPass
    ? clamp(
        (1 - avgProsodyPauseRatio) * 0.55 +
          avgProsodyEnergy * 0.25 +
          lexicalClientCertainty * 0.2,
        0,
        1,
      )
    : Number((lexicalClientCertainty * 0.9).toFixed(2));

  const toneValence = clamp(clientCertainty - clientStress - 0.1, -1, 1);
  const clientValence = clamp(
    prosodyQualityPass ? textValence * 0.75 + toneValence * 0.25 : textValence,
    -1,
    1,
  );
  const clientEngagement = clamp(
    prosodyQualityPass
      ? dynamicsEngagement * 0.6 + clientEnergy * 0.4
      : dynamicsEngagement,
    0,
    1,
  );

  const riskSeverity = clamp(riskFlags.length / 5, 0, 1);
  const topicCoverageScore =
    topicCoverage.checkedTopics.length / LIVE_ANALYSIS_TOPICS.length;
  const callHealth = clamp(
    ((clientValence + 1) / 2) * 0.25 +
      clientEngagement * 0.25 +
      (1 - riskSeverity) * 0.3 +
      topicCoverageScore * 0.2,
    0,
    1,
  );

  const completeness = clamp(inWindow.length / 8, 0, 1);
  const overallConfidence = Number(
    clamp((averageAsrConfidence + completeness) / 2, 0, 1).toFixed(2),
  );

  const evidence = buildEvidence(
    inWindow,
    (chunk) => chunk.speakerRole === "CLIENT",
    2,
  );

  const coach = computeCoach(
    meetingId,
    now,
    riskFlags,
    missingTopics,
    evidence,
    stakeholderSignals,
    coachingAggressiveness,
  );
  const insights = computeInsights(
    meetingId,
    now,
    riskFlags,
    topicCoverage,
    evidence,
    stakeholderSignals,
    clientValence,
    clientEngagement,
  );
  const metrics: LiveAnalysisMetrics = {
    meetingId,
    windowTsStartMs: windowStart,
    windowTsEndMs: now,
    clientValence: Number(clientValence.toFixed(2)),
    clientValenceConfidence: overallConfidence,
    clientEngagement: Number(clientEngagement.toFixed(2)),
    clientEngagementConfidence: overallConfidence,
    clientEnergy: Number(clientEnergy.toFixed(2)),
    clientStress: Number(clientStress.toFixed(2)),
    clientCertainty: Number(clientCertainty.toFixed(2)),
    toneConfidence: Number(toneConfidence.toFixed(2)),
    callHealth: Number((callHealth * 100).toFixed(1)),
    callHealthConfidence: overallConfidence,
    riskFlags,
    talkDynamics,
    topicCoverage,
  };

  const questionFollowUps = computeQuestionFollowUps(inWindow);
  const summary = computeCallSummary({
    nowMs: now,
    metrics,
    riskFlags,
    missingTopics,
    questionFollowUps,
    stakeholderSignals,
  });

  return { metrics, coach, insights, summary };
}
