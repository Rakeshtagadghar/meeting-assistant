import { extractiveSummarize } from "@ainotes/ai";

export interface SummaryResult {
  markdown: string;
  title: string;
  bullets: string[];
  oneLiner: string;
}

/**
 * Generates a markdown summary from note content.
 * Uses extractive summarization to pull key sentences.
 */
export function generateMarkdownSummary(
  noteTitle: string,
  noteContent: string,
): SummaryResult {
  const { bullets, oneLiner } = extractiveSummarize(noteContent);

  const markdown = `# ${noteTitle}

## Summary
${oneLiner}

## Key Points
${bullets.map((b) => `- ${b}`).join("\n")}

## Action Items
- [ ] Review and update notes
- [ ] Share with relevant stakeholders
`;

  return {
    markdown,
    title: noteTitle,
    bullets,
    oneLiner,
  };
}
