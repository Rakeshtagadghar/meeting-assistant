import type { TranscriptChunk } from "./capture";

export interface LiveAnalysisToggleState {
  enabled: boolean;
  enabledAtMs: number | null;
}

export interface LiveAnalysisWindow {
  deltaWindowSec: number;
  contextWindowSec: number;
  useCommittedOnly: boolean;
}

export interface LiveAnalysisSnapshot {
  meetingId: string;
  generatedAtMs: number;
  callHealth: number;
  callHealthConfidence: number;
  clientValence: number;
  clientEngagement: number;
  riskFlags: string[];
}

export interface AnalysisRequestEnvelope {
  meetingId: string;
  chunks: TranscriptChunk[];
  partialText: string | null;
  mode: "light" | "deep";
  privacyMode: boolean;
  window: LiveAnalysisWindow;
}
