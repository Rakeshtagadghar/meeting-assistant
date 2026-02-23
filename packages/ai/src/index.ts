export {
  streamSummarize,
  extractGeneratedTitle,
  stripTitleLine,
} from "./summarizers/ai-summarizer";
export type { StreamSummarizeOptions } from "./summarizers/ai-summarizer";
export { getGroqClient } from "./providers/groq";

// LangChain summary orchestrator
export { generateSummary, regenerateSection } from "./langchain/orchestrator";
export type {
  OrchestratorInput,
  OrchestratorOutput,
  SectionOutput,
  RegenInput,
} from "./langchain/orchestrator";
export { buildSectionQuery } from "./langchain/evidence";
export {
  enforceCitations,
  enforceNoGuessingOwnerDates,
} from "./langchain/validators";
export type { EvidenceSnippet, TemplateSectionSpec } from "./langchain/prompts";
