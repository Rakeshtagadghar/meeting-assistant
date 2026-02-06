export interface Summary {
  bullets: string[];
  oneLiner: string;
}

export function extractiveSummarize(text: string): Summary {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const topSentences = sentences.slice(0, 3);

  return {
    bullets: topSentences,
    oneLiner: topSentences[0] ?? "",
  };
}
