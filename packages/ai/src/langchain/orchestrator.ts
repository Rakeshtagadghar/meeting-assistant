import { AI_MODELS, AI_PROVIDER } from "@ainotes/config/ai-models";
import { createSummaryLLM } from "./llm";
import {
  buildSectionPrompt,
  sectionOutputSchema,
  type EvidenceSnippet,
  type SectionOutputSchema,
  type TemplateSectionSpec,
} from "./prompts";
import { enforceCitations, enforceNoGuessingOwnerDates } from "./validators";

// ─── Types ───

export interface OrchestratorInput {
  meetingMeta: { title: string; participants?: string[] };
  templateSections: TemplateSectionSpec[];
  /** Evidence chunks keyed by section key. Use "*" for global evidence. */
  evidenceBySection: Record<string, EvidenceSnippet[]>;
  /** Section keys that are locked and should not be regenerated */
  lockedSectionKeys?: string[];
  /** Existing section content for locked sections */
  existingSections?: Record<string, SectionOutput>;
}

export interface SectionOutput {
  key: string;
  title: string;
  contentMarkdown: string;
  citations: Array<{
    citationId: string;
    chunkId: string;
    snippet: string;
    timeRange: string | null;
    score: number;
  }>;
  warnings: string[];
}

export interface OrchestratorOutput {
  sections: SectionOutput[];
  combinedMarkdown: string;
  modelInfo: { provider: string; model: string };
}

export interface RegenInput {
  meetingMeta: { title: string; participants?: string[] };
  templateSection: TemplateSectionSpec;
  evidence: EvidenceSnippet[];
}

// ─── Helpers ───

function parseSectionOutput(raw: string): SectionOutputSchema {
  // Strip markdown code block wrappers if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned) as unknown;
  return sectionOutputSchema.parse(parsed);
}

function toSectionOutput(
  key: string,
  title: string,
  parsed: SectionOutputSchema,
): SectionOutput {
  return {
    key,
    title,
    contentMarkdown: parsed.content_markdown,
    citations: parsed.citations.map((c) => ({
      citationId: c.citation_id,
      chunkId: c.chunkId,
      snippet: c.snippet,
      timeRange: c.time_range_optional ?? null,
      score: c.score ?? 0,
    })),
    warnings: parsed.warnings ?? [],
  };
}

function buildCombinedMarkdown(sections: SectionOutput[]): string {
  return sections
    .map((s) => `## ${s.title}\n\n${s.contentMarkdown}`)
    .join("\n\n");
}

// ─── Orchestrator ───

/**
 * Generates a full summary with all template sections.
 * Locked sections are preserved from existingSections.
 * Each unlocked section is generated via LangChain, then validated.
 */
export async function generateSummary(
  input: OrchestratorInput,
): Promise<OrchestratorOutput> {
  const llm = createSummaryLLM();
  const lockedKeys = new Set(input.lockedSectionKeys ?? []);
  const sections: SectionOutput[] = [];

  for (const templateSection of input.templateSections) {
    // Skip locked sections — use existing content
    const existingSection = input.existingSections?.[templateSection.key];
    if (lockedKeys.has(templateSection.key) && existingSection) {
      sections.push(existingSection);
      continue;
    }

    // Gather evidence: section-specific + global
    const sectionEvidence = [
      ...(input.evidenceBySection[templateSection.key] ?? []),
      ...(input.evidenceBySection["*"] ?? []),
    ];

    // Dedupe by id
    const seen = new Set<string>();
    const deduped = sectionEvidence.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    const sectionOutput = await generateSingleSection(
      llm,
      templateSection,
      deduped,
      input.meetingMeta,
    );
    sections.push(sectionOutput);
  }

  return {
    sections,
    combinedMarkdown: buildCombinedMarkdown(sections),
    modelInfo: {
      provider: AI_PROVIDER.GROQ,
      model: AI_MODELS.groq.chatCompletion,
    },
  };
}

/**
 * Regenerates a single section with fresh evidence.
 */
export async function regenerateSection(
  input: RegenInput,
): Promise<SectionOutput> {
  const llm = createSummaryLLM();
  return generateSingleSection(
    llm,
    input.templateSection,
    input.evidence,
    input.meetingMeta,
  );
}

async function generateSingleSection(
  llm: ReturnType<typeof createSummaryLLM>,
  templateSection: TemplateSectionSpec,
  evidence: EvidenceSnippet[],
  meetingMeta: { title: string; participants?: string[] },
  retryCount = 0,
): Promise<SectionOutput> {
  const prompt = buildSectionPrompt(templateSection, evidence, meetingMeta);
  const messages = await prompt.formatMessages({});
  const response = await llm.invoke(messages);

  const rawContent =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let parsed: SectionOutputSchema;
  try {
    parsed = parseSectionOutput(rawContent);
  } catch {
    // If JSON parsing fails, wrap the raw text as content
    parsed = {
      content_markdown: rawContent,
      citations: [],
      warnings: ["Failed to parse structured output; returned raw text."],
    };
  }

  // Run validators
  const citationResult = enforceCitations(parsed, templateSection);
  parsed = citationResult.section;

  // Retry once with all evidence if citation enforcement failed
  if (!citationResult.valid && retryCount === 0 && evidence.length > 0) {
    return generateSingleSection(
      llm,
      templateSection,
      evidence,
      meetingMeta,
      retryCount + 1,
    );
  }

  parsed = enforceNoGuessingOwnerDates(parsed);

  return toSectionOutput(templateSection.key, templateSection.title, parsed);
}
