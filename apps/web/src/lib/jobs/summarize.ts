import { extractiveSummarize } from "@ainotes/ai";
import type { Summary } from "@ainotes/ai";

export interface SummaryResult {
  markdown: string;
  title: string;
  bullets: string[];
  oneLiner: string;
  structured: Summary;
}

/**
 * Generates a markdown summary from note content.
 * Produces structured sections with headings, bullets, and next steps.
 */
export function generateMarkdownSummary(
  noteTitle: string,
  noteContent: string,
): SummaryResult {
  const structured = extractiveSummarize(noteContent);
  const { sections, nextSteps, oneLiner, bullets } = structured;

  const parts: string[] = [`# ${noteTitle}`];

  // One-liner overview
  if (oneLiner) {
    parts.push(`\n> ${oneLiner}\n`);
  }

  // Topic sections
  for (const section of sections) {
    parts.push(`## ${section.heading}`);
    for (const bullet of section.bullets) {
      parts.push(`- ${bullet}`);
    }
    parts.push("");
  }

  // Next Steps (always last)
  if (nextSteps.length > 0) {
    parts.push("## Next Steps");
    for (const step of nextSteps) {
      const ownerTag = step.owner ? ` *(${step.owner})*` : "";
      parts.push(`- ${step.text}${ownerTag}`);
    }
    parts.push("");
  }

  const markdown = parts.join("\n");

  return {
    markdown,
    title: noteTitle,
    bullets,
    oneLiner,
    structured,
  };
}
