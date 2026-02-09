import type { JsonValue } from "@ainotes/core";

/**
 * Parse AI-generated markdown into a SummaryPayload for the SUMMARY AISummary kind.
 */
export function parseMarkdownToSummaryPayload(
  markdown: string,
  fallbackTitle: string,
): JsonValue {
  const lines = markdown.split("\n");

  // Extract title from first H1
  let title = fallbackTitle;
  const h1Match = lines.find((l) => l.startsWith("# "));
  if (h1Match) title = h1Match.replace(/^#\s+/, "").trim();

  // Extract one-liner from blockquote
  let oneLiner = "";
  const bqMatch = lines.find((l) => l.startsWith("> "));
  if (bqMatch) oneLiner = bqMatch.replace(/^>\s+/, "").trim();

  // Extract bullet points (lines starting with - but not task list items)
  const bullets = lines
    .filter((l) => /^[-*]\s/.test(l.trim()) && !/^[-*]\s+\[.\]/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^[-*]\s+/, "")
        .trim(),
    )
    .filter((b) => b.length > 0)
    .slice(0, 8);

  return { title, bullets, oneLiner };
}

/**
 * Parse Next Steps / action items from AI-generated markdown.
 * Looks for task-list items under a "Next Steps" heading.
 */
export function parseNextSteps(markdown: string): {
  text: string;
  owner: string | null;
  due: string | null;
  confidence: number;
}[] {
  const lines = markdown.split("\n");
  const items: {
    text: string;
    owner: string | null;
    due: string | null;
    confidence: number;
  }[] = [];

  let inNextSteps = false;
  for (const line of lines) {
    if (/^##\s+Next\s+Steps/i.test(line)) {
      inNextSteps = true;
      continue;
    }
    if (inNextSteps && /^##\s/.test(line)) {
      break;
    }
    if (inNextSteps && /^[-*]\s/.test(line.trim())) {
      let text = line
        .trim()
        .replace(/^[-*]\s+(\[.\]\s*)?/, "")
        .trim();
      let owner: string | null = null;

      // Extract owner from pattern: — *Name* or -- *Name*
      const ownerMatch = text.match(/\s*[—–-]+\s*\*([^*]+)\*\s*$/);
      if (ownerMatch) {
        owner = ownerMatch[1]?.trim() ?? null;
        text = text.replace(/\s*[—–-]+\s*\*[^*]+\*\s*$/, "").trim();
      }

      if (text) {
        items.push({ text, owner, due: null, confidence: 0.9 });
      }
    }
  }

  return items;
}
