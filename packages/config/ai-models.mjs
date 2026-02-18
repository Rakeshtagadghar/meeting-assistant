const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GOOGLE_EMBEDDING_MODEL = "models/gemini-embedding-001";

export const AI_PROVIDER = Object.freeze({
  GROQ: "groq",
  GOOGLE: "google",
});

export const AI_MODELS = Object.freeze({
  groq: Object.freeze({
    chatCompletion: DEFAULT_GROQ_CHAT_MODEL,
  }),
  google: Object.freeze({
    embeddings: DEFAULT_GOOGLE_EMBEDDING_MODEL,
  }),
});
