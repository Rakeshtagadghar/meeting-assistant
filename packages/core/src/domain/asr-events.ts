// ─── ASR Event types (discriminated union) ───

export type ASRState =
  | "loading"
  | "ready"
  | "listening"
  | "paused"
  | "processing"
  | "stopped"
  | "error";

export interface ASRStatusEvent {
  readonly type: "ASR_STATUS";
  readonly state: ASRState;
  readonly message: string;
}

export interface ASRPartialEvent {
  readonly type: "ASR_PARTIAL";
  readonly text: string;
  readonly tStartMs: number;
}

export interface ASRFinalEvent {
  readonly type: "ASR_FINAL";
  readonly text: string;
  readonly tStartMs: number;
  readonly tEndMs: number;
  readonly speaker: string | null;
  readonly confidence: number | null;
  readonly sequence: number;
}

export type ASREvent = ASRStatusEvent | ASRPartialEvent | ASRFinalEvent;

// ─── Type guards ───

export function isASRStatusEvent(event: ASREvent): event is ASRStatusEvent {
  return event.type === "ASR_STATUS";
}

export function isASRPartialEvent(event: ASREvent): event is ASRPartialEvent {
  return event.type === "ASR_PARTIAL";
}

export function isASRFinalEvent(event: ASREvent): event is ASRFinalEvent {
  return event.type === "ASR_FINAL";
}

// ─── ASR Provider interface (platform-agnostic) ───

export interface ASROptions {
  readonly language: string; // "auto" | "en" | "es" | etc.
  readonly sampleRate: number;
}

export interface ASRProvider {
  readonly name: string;
  readonly platform: "web" | "desktop";

  initialize(
    modelId: string,
    onProgress?: (pct: number) => void,
  ): Promise<void>;
  isReady(): boolean;

  startListening(options: ASROptions): void;
  stopListening(): void;
  pauseListening(): void;
  resumeListening(): void;

  onEvent(handler: (event: ASREvent) => void): () => void; // returns unsubscribe

  dispose(): void;
}
