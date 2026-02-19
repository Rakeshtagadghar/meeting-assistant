import type { TranscriptChunk } from "@ainotes/shared-types";
import type { MobileSessionRuntimeState } from "../runtime/mobile-session-runtime";
import type { MobileSessionRuntime } from "../runtime/mobile-session-runtime";

export type MobileSessionTab = "transcript" | "analysis";

export interface TranscriptLineItem {
  id: string;
  sequence: number;
  speakerLabel: string;
  text: string;
  confidence: number | null;
  tStartMs: number;
  tEndMs: number;
}

export interface LiveAnalysisViewState {
  visible: boolean;
  hiddenReason: string | null;
  generatedAtMs: number | null;
  callHealth: number | null;
  callHealthConfidence: number | null;
  clientValence: number | null;
  clientEngagement: number | null;
  riskFlags: string[];
}

export interface MobileSessionViewModel {
  connectionStatus: MobileSessionRuntimeState["connectionStatus"];
  sessionState: MobileSessionRuntimeState["sessionState"];
  sessionMessage: string | null;
  selectedTab: MobileSessionTab;
  transcriptItems: TranscriptLineItem[];
  partialText: string | null;
  analysis: LiveAnalysisViewState;
  controls: {
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
    canStop: boolean;
    canToggleLiveAnalysis: boolean;
  };
}

type PresenterListener = (state: MobileSessionViewModel) => void;

export interface MobileSessionPresenterOptions {
  runtime: MobileSessionRuntime;
  initialTab?: MobileSessionTab;
}

export class MobileSessionPresenter {
  private readonly runtime: MobileSessionRuntime;
  private readonly unsubscribeRuntime: () => void;
  private readonly listeners = new Set<PresenterListener>();
  private selectedTab: MobileSessionTab;
  private viewModel: MobileSessionViewModel;

  constructor(options: MobileSessionPresenterOptions) {
    this.runtime = options.runtime;
    this.selectedTab = options.initialTab ?? "transcript";
    this.viewModel = buildMobileSessionViewModel(
      this.runtime.getState(),
      this.selectedTab,
    );
    this.unsubscribeRuntime = this.runtime.subscribe((state) => {
      this.viewModel = buildMobileSessionViewModel(state, this.selectedTab);
      this.emit();
    });
  }

  subscribe(listener: PresenterListener): () => void {
    this.listeners.add(listener);
    listener(this.viewModel);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getViewModel(): MobileSessionViewModel {
    return this.viewModel;
  }

  selectTab(tab: MobileSessionTab): void {
    if (this.selectedTab === tab) return;
    this.selectedTab = tab;
    this.viewModel = buildMobileSessionViewModel(
      this.runtime.getState(),
      this.selectedTab,
    );
    this.emit();
  }

  async start(args?: { liveAnalysisEnabled?: boolean }): Promise<void> {
    await this.runtime.start(args);
  }

  async pause(): Promise<void> {
    await this.runtime.pause();
  }

  async resume(): Promise<void> {
    await this.runtime.resume();
  }

  async stop(): Promise<void> {
    await this.runtime.stop();
  }

  setLiveAnalysisEnabled(enabled: boolean): void {
    this.runtime.setLiveAnalysisEnabled(enabled);
  }

  dispose(): void {
    this.unsubscribeRuntime();
    this.listeners.clear();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.viewModel);
    }
  }
}

export function buildMobileSessionViewModel(
  state: MobileSessionRuntimeState,
  selectedTab: MobileSessionTab,
): MobileSessionViewModel {
  return {
    connectionStatus: state.connectionStatus,
    sessionState: state.sessionState,
    sessionMessage: state.sessionMessage,
    selectedTab,
    transcriptItems: state.transcript.map(mapTranscriptChunk),
    partialText: state.partialText,
    analysis: buildAnalysisViewState(state),
    controls: {
      canStart:
        state.sessionState !== "listening" && state.sessionState !== "paused",
      canPause: state.sessionState === "listening",
      canResume: state.sessionState === "paused",
      canStop:
        state.sessionState === "listening" || state.sessionState === "paused",
      canToggleLiveAnalysis:
        state.sessionState === "listening" || state.sessionState === "paused",
    },
  };
}

function buildAnalysisViewState(
  state: MobileSessionRuntimeState,
): LiveAnalysisViewState {
  if (!state.liveAnalysisEnabled) {
    return {
      visible: false,
      hiddenReason: "Live Analysis is off.",
      generatedAtMs: null,
      callHealth: null,
      callHealthConfidence: null,
      clientValence: null,
      clientEngagement: null,
      riskFlags: [],
    };
  }

  if (!state.latestAnalysis) {
    return {
      visible: true,
      hiddenReason: "Waiting for first analysis tick.",
      generatedAtMs: null,
      callHealth: null,
      callHealthConfidence: null,
      clientValence: null,
      clientEngagement: null,
      riskFlags: [],
    };
  }

  return {
    visible: true,
    hiddenReason: null,
    generatedAtMs: state.latestAnalysis.generatedAtMs,
    callHealth: state.latestAnalysis.callHealth,
    callHealthConfidence: state.latestAnalysis.callHealthConfidence,
    clientValence: state.latestAnalysis.clientValence,
    clientEngagement: state.latestAnalysis.clientEngagement,
    riskFlags: [...state.latestAnalysis.riskFlags],
  };
}

function mapTranscriptChunk(chunk: TranscriptChunk): TranscriptLineItem {
  const speaker = chunk.speaker?.trim() ? chunk.speaker : chunk.speakerRole;
  return {
    id: chunk.id,
    sequence: chunk.sequence,
    speakerLabel: speaker,
    text: chunk.text,
    confidence: chunk.confidence,
    tStartMs: chunk.tStartMs,
    tEndMs: chunk.tEndMs,
  };
}
