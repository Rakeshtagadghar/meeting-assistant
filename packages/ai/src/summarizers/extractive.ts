/** A single section in the structured summary. */
export interface SummarySection {
  heading: string;
  bullets: string[];
}

/** An action item extracted from the text. */
export interface ActionItem {
  text: string;
  owner: string | null;
}

/** Full structured summary output. */
export interface Summary {
  /** One-line overview of the content */
  oneLiner: string;
  /** Flat list of top key points (for backwards compat) */
  bullets: string[];
  /** Grouped sections with headings */
  sections: SummarySection[];
  /** Extracted action items / next steps */
  nextSteps: ActionItem[];
}

// ─── Internals ───

const ACTION_PATTERNS = [
  /\b(?:need to|needs to|should|will|must|has to|have to|going to|plan to|assigned to|responsible for|follow up|action item|todo|to-do|task)\b/i,
  /\b(?:request|get|send|share|review|update|create|set up|prepare|schedule|arrange|coordinate|reach out|reconnect|check)\b/i,
];

const OWNER_PATTERNS = [
  // "X will do Y", "X needs to do Y", "X should do Y"
  /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:will|should|needs? to|has to|is going to|must)\s+(.+)/,
  // "assigned to X", "owner: X"
  /(?:assigned to|owner[:\s]+|responsibility of)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i,
  // "X is responsible for Y"
  /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+is\s+responsible\s+for\s+(.+)/,
];

const FILLER_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "up",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "because",
  "as",
  "until",
  "while",
  "that",
  "which",
  "who",
  "whom",
  "this",
  "these",
  "those",
  "am",
  "it",
  "its",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "they",
  "them",
  "their",
  "what",
  "and",
  "but",
  "or",
  "if",
  "also",
  "like",
  "going",
  "get",
  "got",
  "go",
  "said",
  "say",
]);

/** Split text into sentences, handling common abbreviations. */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation or newlines
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

/** Extract meaningful keywords from a sentence. */
function extractKeywords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER_WORDS.has(w));
}

/** Score a sentence by importance (keyword density, position bonus, length). */
function scoreSentence(
  sentence: string,
  keywordFreq: Map<string, number>,
): number {
  const words = extractKeywords(sentence);
  if (words.length === 0) return 0;

  // Sum of keyword frequencies gives a TF-like score
  let score = 0;
  for (const w of words) {
    score += keywordFreq.get(w) ?? 0;
  }
  // Normalize by word count
  score = score / words.length;

  // Penalize very short sentences
  if (sentence.length < 20) score *= 0.5;
  // Penalize very long sentences (likely run-ons from speech)
  if (sentence.length > 300) score *= 0.7;

  return score;
}

/** Check if a sentence looks like an action item. */
function isActionSentence(sentence: string): boolean {
  return ACTION_PATTERNS.some((p) => p.test(sentence));
}

/** Try to extract an owner from an action sentence. */
function extractOwner(sentence: string): {
  text: string;
  owner: string | null;
} {
  for (const pattern of OWNER_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) {
      // Pattern 1 & 3: group 1 is owner, group 2 is the action
      if (match[2]) {
        return { text: match[2].trim(), owner: match[1] ?? null };
      }
      // Pattern 2: owner is in the sentence, keep full text
      return { text: sentence, owner: match[1] ?? null };
    }
  }
  return { text: sentence, owner: null };
}

/**
 * Build a keyword frequency map across all sentences.
 * Words that appear in many sentences are "important topics".
 */
function buildKeywordFrequency(sentences: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const sentence of sentences) {
    // Use a set so each word counts once per sentence
    const unique = new Set(extractKeywords(sentence));
    for (const word of unique) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return freq;
}

/**
 * Group sentences into topic clusters by finding keyword overlap.
 * Sentences with high keyword overlap are grouped together.
 */
function clusterByTopic(
  sentences: string[],
  maxSections: number,
): { heading: string; sentenceIndices: number[] }[] {
  if (sentences.length === 0) return [];

  const keywordSets = sentences.map((s) => new Set(extractKeywords(s)));

  // Simple sequential clustering: start a new cluster when keyword
  // overlap with the current cluster drops below threshold.
  const clusters: { indices: number[]; keywords: Set<string> }[] = [];
  let current: { indices: number[]; keywords: Set<string> } = {
    indices: [0],
    keywords: new Set(keywordSets[0]),
  };

  for (let i = 1; i < sentences.length; i++) {
    const sentenceKw = keywordSets[i]!;
    if (sentenceKw.size === 0) {
      current.indices.push(i);
      continue;
    }

    // Compute Jaccard-like overlap with current cluster keywords
    let overlap = 0;
    for (const w of sentenceKw) {
      if (current.keywords.has(w)) overlap++;
    }
    const similarity = overlap / Math.max(sentenceKw.size, 1);

    if (similarity < 0.15 && current.indices.length >= 2) {
      // Topic shift — start new cluster
      clusters.push(current);
      current = { indices: [i], keywords: new Set(sentenceKw) };
    } else {
      current.indices.push(i);
      for (const w of sentenceKw) current.keywords.add(w);
    }
  }
  clusters.push(current);

  // Merge tiny clusters with neighbors if we have too many
  while (clusters.length > maxSections) {
    // Find smallest cluster and merge with neighbor
    let minIdx = 0;
    let minSize = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i]!.indices.length < minSize) {
        minSize = clusters[i]!.indices.length;
        minIdx = i;
      }
    }
    const mergeWith = minIdx > 0 ? minIdx - 1 : minIdx + 1;
    if (mergeWith < clusters.length) {
      const target = clusters[mergeWith]!;
      const source = clusters[minIdx]!;
      target.indices.push(...source.indices);
      target.indices.sort((a, b) => a - b);
      for (const w of source.keywords) target.keywords.add(w);
      clusters.splice(minIdx, 1);
    } else {
      break;
    }
  }

  // Generate heading for each cluster from top keywords
  return clusters.map((cluster) => {
    // Find the most frequent non-filler words in this cluster
    const wordCounts = new Map<string, number>();
    for (const idx of cluster.indices) {
      for (const w of keywordSets[idx]!) {
        wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      }
    }
    const topWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    const heading = topWords.length > 0 ? topWords.join(" & ") : "Discussion";

    return { heading, sentenceIndices: cluster.indices };
  });
}

/**
 * Extractive summarization for meeting notes.
 *
 * Analyzes text to produce structured sections with headings,
 * key bullet points, and a "Next Steps" section with assignees.
 */
export function extractiveSummarize(text: string): Summary {
  if (!text.trim()) {
    return { oneLiner: "", bullets: [], sections: [], nextSteps: [] };
  }

  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return { oneLiner: "", bullets: [], sections: [], nextSteps: [] };
  }

  const keywordFreq = buildKeywordFrequency(sentences);

  // Separate action items from discussion content
  const actionIndices = new Set<number>();
  const nextSteps: ActionItem[] = [];

  for (let i = 0; i < sentences.length; i++) {
    if (isActionSentence(sentences[i]!)) {
      actionIndices.add(i);
      const { text: actionText, owner } = extractOwner(sentences[i]!);
      // Clean up the action text
      const cleaned = actionText
        .replace(/^[-•*]\s*/, "")
        .replace(/[.!?]+$/, "")
        .trim();
      if (cleaned.length > 5) {
        nextSteps.push({ text: cleaned, owner });
      }
    }
  }

  // Cluster non-action sentences into topic sections
  const discussionSentences = sentences.filter((_, i) => !actionIndices.has(i));

  const maxSections = Math.max(
    2,
    Math.min(6, Math.ceil(discussionSentences.length / 4)),
  );
  const clusters = clusterByTopic(discussionSentences, maxSections);

  // For each cluster, pick the top-scoring sentences as bullets
  const sections: SummarySection[] = [];
  const allBullets: string[] = [];

  for (const cluster of clusters) {
    const clusterSentences = cluster.sentenceIndices.map(
      (i) => discussionSentences[i]!,
    );

    // Score and rank sentences within this cluster
    const scored = clusterSentences
      .map((s, localIdx) => ({
        sentence: s,
        score: scoreSentence(s, keywordFreq),
        originalIdx: cluster.sentenceIndices[localIdx]!,
      }))
      .sort((a, b) => b.score - a.score);

    // Pick top sentences (up to 4 per section)
    const topCount = Math.min(
      4,
      Math.max(1, Math.ceil(clusterSentences.length * 0.5)),
    );
    const bullets = scored
      .slice(0, topCount)
      // Re-sort by original position to maintain narrative order
      .sort((a, b) => a.originalIdx - b.originalIdx)
      .map((s) => s.sentence.replace(/[.!?]+$/, "").trim())
      .filter((b) => b.length > 5);

    if (bullets.length > 0) {
      sections.push({ heading: cluster.heading, bullets });
      allBullets.push(...bullets);
    }
  }

  // If there are action items that didn't get extracted as next steps,
  // and we have no next steps yet, add generic ones from action sentences
  if (nextSteps.length === 0 && actionIndices.size > 0) {
    for (const idx of actionIndices) {
      const { text: actionText, owner } = extractOwner(sentences[idx]!);
      const cleaned = actionText.replace(/[.!?]+$/, "").trim();
      if (cleaned.length > 5) {
        nextSteps.push({ text: cleaned, owner });
      }
    }
  }

  // Generate one-liner from the highest-scoring sentence overall
  const oneLiner =
    allBullets[0] ?? sentences[0]?.replace(/[.!?]+$/, "").trim() ?? "";

  return {
    oneLiner,
    bullets: allBullets.slice(0, 6),
    sections,
    nextSteps,
  };
}
