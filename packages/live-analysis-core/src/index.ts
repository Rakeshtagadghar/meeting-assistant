export const LIVE_ANALYSIS_CADENCE_MS = 15_000;
export const LIVE_ANALYSIS_DEFAULT_CONTEXT_SEC = 120;
export const LIVE_ANALYSIS_WARMUP_CONTEXT_SEC = 60;
export const LIVE_ANALYSIS_UI_COOLDOWN_MS = 8_000;
export const LIVE_ANALYSIS_MIN_CONFIDENCE = 0.55;

export interface LiveAnalysisGate {
  setEnabled: (enabled: boolean) => void;
  shouldRun: (nowMs: number) => boolean;
  markRun: (nowMs: number) => void;
}

export function shouldAcceptAnalysisUpdate(args: {
  confidence: number;
  nowMs: number;
  lastUiUpdateMs: number | null;
  minConfidence?: number;
  cooldownMs?: number;
}): boolean {
  const minConfidence = args.minConfidence ?? LIVE_ANALYSIS_MIN_CONFIDENCE;
  const cooldownMs = args.cooldownMs ?? LIVE_ANALYSIS_UI_COOLDOWN_MS;
  if (args.confidence < minConfidence) return false;
  if (args.lastUiUpdateMs === null) return true;
  return args.nowMs - args.lastUiUpdateMs >= cooldownMs;
}

export function resolveAnalysisContextWindowSec(args: {
  warmupPending: boolean;
  warmupWindowSec?: number;
  defaultWindowSec?: number;
}): number {
  if (args.warmupPending) {
    return args.warmupWindowSec ?? LIVE_ANALYSIS_WARMUP_CONTEXT_SEC;
  }
  return args.defaultWindowSec ?? LIVE_ANALYSIS_DEFAULT_CONTEXT_SEC;
}

export function createLiveAnalysisGate(): LiveAnalysisGate {
  let enabled = false;
  let lastRunAtMs: number | null = null;

  return {
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      if (!enabled) {
        lastRunAtMs = null;
      }
    },
    shouldRun(nowMs: number) {
      if (!enabled) return false;
      if (lastRunAtMs === null) return true;
      return nowMs - lastRunAtMs >= LIVE_ANALYSIS_CADENCE_MS;
    },
    markRun(nowMs: number) {
      lastRunAtMs = nowMs;
    },
  };
}
