export declare const AI_PROVIDER: {
  readonly GROQ: "groq";
  readonly GOOGLE: "google";
};

export declare const AI_MODELS: {
  readonly groq: {
    readonly chatCompletion: string;
    readonly realtimeTranscription: string;
  };
  readonly google: {
    readonly embeddings: string;
  };
  readonly elevenlabs: {
    readonly realtimeStt: string;
  };
};
