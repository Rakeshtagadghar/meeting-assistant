const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GROQ_REALTIME_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const DEFAULT_GOOGLE_EMBEDDING_MODEL = "models/gemini-embedding-001";
const DEFAULT_ELEVENLABS_REALTIME_STT_MODEL = "scribe-v2-realtime";

export const AI_PROVIDER = Object.freeze({
  GROQ: "groq",
  GOOGLE: "google",
});

export const AI_MODELS = Object.freeze({
  groq: Object.freeze({
    chatCompletion: DEFAULT_GROQ_CHAT_MODEL,
    realtimeTranscription: DEFAULT_GROQ_REALTIME_TRANSCRIPTION_MODEL,
  }),
  google: Object.freeze({
    embeddings: DEFAULT_GOOGLE_EMBEDDING_MODEL,
  }),
  elevenlabs: Object.freeze({
    realtimeStt: DEFAULT_ELEVENLABS_REALTIME_STT_MODEL,
  }),
});
