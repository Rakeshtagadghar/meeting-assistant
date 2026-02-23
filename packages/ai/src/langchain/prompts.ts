import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

export const SYSTEM_SUMMARY_PROMPT = `You generate meeting summaries ONLY from the provided evidence snippets. Never invent facts. Every decision, action item, date, or number MUST include citations referencing snippet ids. If you cannot find evidence for a claim, omit it.

Output MUST be valid JSON matching the schema exactly. Do not wrap in markdown code blocks.`;

export const citationSchema = z.object({
  citation_id: z.string().describe("Unique ID for this citation"),
  chunkId: z.string().describe("The chunk ID from the evidence"),
  snippet: z.string().describe("Brief excerpt from the source"),
  time_range_optional: z
    .string()
    .optional()
    .describe("Time range if from transcript"),
  score: z.number().optional().describe("Relevance score"),
});

export const sectionOutputSchema = z.object({
  content_markdown: z.string().describe("The section content in markdown"),
  citations: z
    .array(citationSchema)
    .describe("Citations grounding the content"),
  warnings: z
    .array(z.string())
    .optional()
    .describe("Any warnings about missing evidence"),
});

export type SectionOutputSchema = z.infer<typeof sectionOutputSchema>;

export interface EvidenceSnippet {
  id: string;
  title: string;
  sourceType: string;
  text: string;
  timeRange?: string;
  score?: number;
}

export interface TemplateSectionSpec {
  key: string;
  title: string;
  format: string;
  required: boolean;
  instructions: string;
  maxItems?: number;
}

export function buildSectionPrompt(
  section: TemplateSectionSpec,
  evidenceSnippets: EvidenceSnippet[],
  meetingMeta: { title: string; participants?: string[] },
): ChatPromptTemplate {
  const evidenceBlock = evidenceSnippets
    .map(
      (s) =>
        `[ID: ${s.id}] (${s.sourceType}${s.timeRange ? `, ${s.timeRange}` : ""}) "${s.title}"\n${s.text}`,
    )
    .join("\n\n");

  const formatInstruction =
    section.format === "checklist"
      ? "Use markdown task list syntax (- [ ] item)."
      : section.format === "bullets"
        ? "Use markdown bullet points."
        : "Use free-form markdown paragraphs.";

  const maxItemsNote = section.maxItems
    ? `\nMaximum ${section.maxItems} items.`
    : "";

  return ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_SUMMARY_PROMPT],
    [
      "human",
      `Generate the "${section.title}" section for the meeting summary.

Meeting: ${meetingMeta.title}${meetingMeta.participants?.length ? `\nParticipants: ${meetingMeta.participants.join(", ")}` : ""}

Section instructions: ${section.instructions}
Format: ${formatInstruction}${maxItemsNote}

Evidence snippets:
${evidenceBlock}

Respond with a JSON object with these fields:
- "content_markdown": string (the section content in markdown)
- "citations": array of objects with "citation_id", "chunkId", "snippet", and optionally "time_range_optional" and "score"
- "warnings": array of strings (any warnings, or empty array)

JSON response:`,
    ],
  ]);
}
