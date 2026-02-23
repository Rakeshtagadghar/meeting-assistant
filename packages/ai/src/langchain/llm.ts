import { ChatGroq } from "@langchain/groq";
import { AI_MODELS } from "@ainotes/config/ai-models";

export function createSummaryLLM(options?: { temperature?: number }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  return new ChatGroq({
    model: AI_MODELS.groq.chatCompletion,
    temperature: options?.temperature ?? 0.2,
    maxTokens: 4096,
    apiKey,
  });
}
