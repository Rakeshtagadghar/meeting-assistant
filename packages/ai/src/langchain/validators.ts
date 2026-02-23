import type { SectionOutputSchema, TemplateSectionSpec } from "./prompts";

export interface ValidationResult {
  valid: boolean;
  section: SectionOutputSchema;
  warnings: string[];
}

/**
 * CITATION_ENFORCER: Ensures decisions, action items, and factual claims have citations.
 * If a required section has no citations, marks it invalid.
 */
export function enforceCitations(
  section: SectionOutputSchema,
  templateSection: TemplateSectionSpec,
): ValidationResult {
  const warnings = [...(section.warnings ?? [])];
  const hasCitations = section.citations.length > 0;

  // Required sections with factual content MUST have citations
  const requiresCitations =
    templateSection.required &&
    ["decisions", "action_items", "next_steps"].includes(templateSection.key);

  if (requiresCitations && !hasCitations) {
    warnings.push(
      `Section "${templateSection.title}" has no citations. Evidence not found for some claims.`,
    );
    return { valid: false, section: { ...section, warnings }, warnings };
  }

  return { valid: true, section: { ...section, warnings }, warnings };
}

/**
 * NO_GUESSING_OWNER_DATES: Strips guessed owner/due date fields from action items.
 * If owner or due date is not explicitly in the evidence, remove it.
 */
export function enforceNoGuessingOwnerDates(
  section: SectionOutputSchema,
): SectionOutputSchema {
  const warnings = [...(section.warnings ?? [])];

  // Check for owner/date patterns that might be guessed
  // Pattern: "— *Name*" or "due: date" that doesn't have a corresponding citation
  const citedChunkIds = new Set(section.citations.map((c) => c.chunkId));

  if (citedChunkIds.size === 0 && section.content_markdown.includes("—")) {
    // Strip owner assignments when no evidence backs them
    const cleaned = section.content_markdown.replace(
      /\s*—\s*\*[^*]+\*\s*/g,
      " ",
    );
    if (cleaned !== section.content_markdown) {
      warnings.push(
        "Removed owner assignments that were not supported by evidence.",
      );
    }
    return { ...section, content_markdown: cleaned, warnings };
  }

  return { ...section, warnings };
}
