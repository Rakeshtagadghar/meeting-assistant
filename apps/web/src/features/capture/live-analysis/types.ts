export const LIVE_ANALYSIS_STREAM_STATUSES = [
  "idle",
  "connecting",
  "live",
  "reconnecting",
  "error",
] as const;

export type LiveAnalysisStreamStatus =
  (typeof LIVE_ANALYSIS_STREAM_STATUSES)[number];

export const LIVE_ANALYSIS_RISK_FLAGS = [
  "priceObjection",
  "timingObjection",
  "trustConcern",
  "featureGap",
  "securityConcern",
  "integrationConcern",
  "competitorMention",
  "confusion",
  "frustration",
  "lowEngagement",
  "scopeMismatch",
] as const;

export type LiveAnalysisRiskFlag = (typeof LIVE_ANALYSIS_RISK_FLAGS)[number];

export const LIVE_ANALYSIS_TOPICS = [
  "needProblem",
  "budget",
  "timeline",
  "decisionMaker",
  "alternativesCompetitors",
  "technicalFit",
  "securityCompliance",
  "procurement",
  "nextSteps",
] as const;

export type LiveAnalysisTopic = (typeof LIVE_ANALYSIS_TOPICS)[number];

export type LiveAnalysisSpeakerRole = "SALES" | "CLIENT" | "UNKNOWN";
export type LiveAnalysisAudioSource = "microphone" | "systemAudio" | "tabAudio";

export interface LiveAnalysisChunkInput {
  id?: string;
  sequence?: number;
  tStartMs: number;
  tEndMs: number;
  speaker: string | null;
  speakerRole?: LiveAnalysisSpeakerRole;
  audioSource?: LiveAnalysisAudioSource;
  text: string;
  confidence: number | null;
}

export interface LiveAnalysisEvidenceSnippet {
  utteranceId: string;
  speakerRole: LiveAnalysisSpeakerRole;
  tsStartMs: number;
  tsEndMs: number;
  text: string;
}

export interface LiveAnalysisTalkDynamics {
  talkRatioSalesPct: number;
  talkRatioClientPct: number;
  interruptionsCount: number;
  paceWpmSales: number;
  paceWpmClient: number;
}

export interface LiveAnalysisTopicCoverage {
  checkedTopics: LiveAnalysisTopic[];
  confidenceByTopic: Record<LiveAnalysisTopic, number>;
}

export interface LiveAnalysisMetrics {
  meetingId: string;
  windowTsStartMs: number;
  windowTsEndMs: number;
  clientValence: number;
  clientValenceConfidence: number;
  clientEngagement: number;
  clientEngagementConfidence: number;
  clientEnergy: number;
  clientStress: number;
  clientCertainty: number;
  callHealth: number;
  callHealthConfidence: number;
  riskFlags: LiveAnalysisRiskFlag[];
  talkDynamics: LiveAnalysisTalkDynamics;
  topicCoverage: LiveAnalysisTopicCoverage;
}

export type LiveAnalysisInsightType =
  | "objection"
  | "risk"
  | "positiveSignal"
  | "topic"
  | "coach";

export type LiveAnalysisSeverity = "low" | "medium" | "high";

export interface LiveAnalysisInsight {
  meetingId: string;
  insightId: string;
  timestampMs: number;
  type: LiveAnalysisInsightType;
  severity: LiveAnalysisSeverity;
  title: string;
  detail: string;
  confidence: number;
  evidenceSnippets: LiveAnalysisEvidenceSnippet[];
}

export type CoachSuggestionIntent =
  | "addressObjection"
  | "clarify"
  | "valueReinforce"
  | "close"
  | "discovery"
  | "rapport";

export interface LiveAnalysisCoachSuggestion {
  suggestionId: string;
  text: string;
  intent: CoachSuggestionIntent;
  confidence: number;
  evidenceSnippets: string[];
}

export type CoachQuestionIntent =
  | "discovery"
  | "budget"
  | "timeline"
  | "dm"
  | "risk"
  | "close";

export interface LiveAnalysisCoachQuestion {
  questionId: string;
  text: string;
  intent: CoachQuestionIntent;
  confidence: number;
  evidenceSnippets: string[];
}

export interface LiveAnalysisCoachDoDont {
  id: string;
  type: "do" | "dont";
  text: string;
  confidence: number;
  evidenceSnippets: string[];
}

export interface LiveAnalysisCoachPayload {
  meetingId: string;
  generatedAtMs: number;
  nextBestSay: LiveAnalysisCoachSuggestion[];
  nextQuestions: LiveAnalysisCoachQuestion[];
  doDont: LiveAnalysisCoachDoDont[];
}

export type LiveAnalysisFollowUpStatus = "answered" | "weak" | "missed";

export interface LiveAnalysisQuestionFollowUp {
  questionId: string;
  questionText: string;
  askedAtMs: number;
  status: LiveAnalysisFollowUpStatus;
  responseText: string | null;
  suggestedRecovery: string;
}

export interface LiveAnalysisCallSummary {
  updatedAtMs: number;
  overallAssessment: "strong" | "mixed" | "atRisk";
  headline: string;
  strengths: string[];
  misses: string[];
  immediateActions: string[];
  questionFollowUps: LiveAnalysisQuestionFollowUp[];
}

export type LiveAnalysisMode = "light" | "deep";

export interface LiveAnalysisRequestBody {
  enabled: boolean;
  mode?: LiveAnalysisMode;
  privacyMode?: boolean;
  sensitivity?: number;
  coachingAggressiveness?: number;
  chunks?: LiveAnalysisChunkInput[];
  partialText?: string | null;
}

export interface LiveAnalysisResponse {
  meetingId: string;
  streamStatus: LiveAnalysisStreamStatus;
  latencyMs: number;
  mode: LiveAnalysisMode;
  metrics: LiveAnalysisMetrics | null;
  coach: LiveAnalysisCoachPayload | null;
  insights: LiveAnalysisInsight[];
  summary: LiveAnalysisCallSummary | null;
}
