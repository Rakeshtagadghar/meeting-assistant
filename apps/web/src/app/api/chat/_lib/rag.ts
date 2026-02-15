import type { Prisma } from "@prisma/client";
import type {
  ChatCitation,
  ChatFilters,
  ChatMode,
  ChatScope,
} from "@/features/chat/types";
import {
  extractRagChunks,
  type NoteForRag,
  type RagChunk,
} from "@/lib/chat/chunks";

export interface BuildNoteWhereOptions {
  userId: string;
  userEmail: string | null;
  scope: ChatScope;
  filters?: ChatFilters;
  query?: string;
}

export interface RetrievedChunk extends RagChunk {
  score: number;
  lexicalScore: number;
  vectorScore: number;
}

export interface RankChunkOptions {
  vectorScores?: Map<string, number>;
  hybridWeights?: {
    lexical: number;
    vector: number;
  };
}

export type { NoteForRag };

export function normalizeScope(scope: string | undefined): ChatScope {
  switch (scope) {
    case "my_notes":
    case "all_meetings":
    case "folder":
    case "tag":
    case "date_range":
    case "shared_with_me":
      return scope;
    default:
      return "my_notes";
  }
}

export function normalizeMode(mode: string | undefined): ChatMode {
  switch (mode) {
    case "qa":
    case "summarize":
    case "action_items":
    case "email_draft":
      return mode;
    default:
      return "auto";
  }
}

export function buildNoteWhere({
  userId,
  userEmail,
  scope,
  filters,
  query,
}: BuildNoteWhereOptions): Prisma.NoteWhereInput {
  const where: Prisma.NoteWhereInput = { deletedAt: null };

  if (scope === "shared_with_me") {
    if (userEmail) {
      where.shareLinks = {
        some: {
          allowedEmails: {
            has: userEmail,
          },
        },
      };
      where.userId = { not: userId };
    } else {
      where.id = "__no_email__";
      return where;
    }
  } else {
    where.userId = userId;
  }

  if (scope === "all_meetings") {
    where.type = "MEETING";
  }

  if (scope === "folder" && filters?.folderId) {
    where.folderId = filters.folderId;
  }

  if (scope === "tag" && filters?.tag) {
    where.tags = { has: filters.tag };
  }

  if (filters?.noteType) {
    where.type = filters.noteType;
  }

  if (filters?.folderId && scope !== "folder") {
    where.folderId = filters.folderId;
  }

  if (filters?.tag && scope !== "tag") {
    where.tags = { has: filters.tag };
  }

  const dateRange = filters?.dateRange;
  if (dateRange?.from || dateRange?.to) {
    where.updatedAt = {
      ...(dateRange.from ? { gte: new Date(dateRange.from) } : {}),
      ...(dateRange.to ? { lte: new Date(dateRange.to) } : {}),
    };
  }

  const cleanedQuery = query?.trim();
  if (cleanedQuery) {
    where.OR = [
      { title: { contains: cleanedQuery, mode: "insensitive" } },
      { contentPlain: { contains: cleanedQuery, mode: "insensitive" } },
    ];
  }

  return where;
}

function tokenizeQuery(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  const matches = text.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, "g"));
  return matches?.length ?? 0;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recencyBoost(updatedAt: Date): number {
  const daysAgo = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 3) return 0.12;
  if (daysAgo <= 14) return 0.08;
  if (daysAgo <= 45) return 0.04;
  return 0;
}

function scoreChunkText(
  text: string,
  tokens: string[],
  updatedAt: Date,
  queryPresent: boolean,
): number {
  if (!text.trim()) return 0;
  if (!queryPresent) return recencyBoost(updatedAt);

  const normalizedText = text.toLowerCase();
  let matchedTerms = 0;
  let totalHits = 0;

  for (const token of tokens) {
    const hits = countOccurrences(normalizedText, token);
    if (hits > 0) matchedTerms += 1;
    totalHits += hits;
  }

  if (matchedTerms === 0) return 0;

  const coverage = matchedTerms / Math.max(tokens.length, 1);
  const hitBoost = Math.min(0.2, totalHits * 0.03);
  const densityBoost = Math.min(0.1, totalHits / Math.max(text.length / 30, 1));

  return coverage * 0.7 + hitBoost + densityBoost + recencyBoost(updatedAt);
}

function combineScore(
  lexicalScore: number,
  vectorScore: number,
  options?: RankChunkOptions,
): number {
  const hasVector = (options?.vectorScores?.size ?? 0) > 0;
  if (!hasVector) return lexicalScore;

  const lexicalWeight = options?.hybridWeights?.lexical ?? 0.4;
  const vectorWeight = options?.hybridWeights?.vector ?? 0.6;
  return lexicalWeight * lexicalScore + vectorWeight * Math.max(0, vectorScore);
}

function snippetFromText(text: string, query: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const terms = tokenizeQuery(query);
  const lowercase = normalized.toLowerCase();

  let index = -1;
  for (const term of terms) {
    const termIndex = lowercase.indexOf(term.toLowerCase());
    if (termIndex >= 0) {
      index = termIndex;
      break;
    }
  }

  if (index < 0) {
    return normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 3)}...`
      : normalized;
  }

  const start = Math.max(0, index - Math.floor(maxLength / 3));
  const end = Math.min(normalized.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

export function rankChunks(
  notes: NoteForRag[],
  query: string,
  limit = 8,
  options?: RankChunkOptions,
): RetrievedChunk[] {
  const cleanedQuery = query.trim();
  const hasQuery = cleanedQuery.length > 0;
  const tokens = tokenizeQuery(cleanedQuery);
  const vectorScores = options?.vectorScores ?? new Map<string, number>();
  const rawChunks = extractRagChunks(notes);

  const scored = rawChunks
    .map((chunk) => {
      const lexicalScore = scoreChunkText(
        chunk.text,
        tokens,
        chunk.updatedAt,
        hasQuery,
      );
      const vectorScore = vectorScores.get(chunk.id) ?? 0;
      const score = combineScore(lexicalScore, vectorScore, options);
      return {
        ...chunk,
        lexicalScore,
        vectorScore,
        score,
      };
    })
    .filter((chunk) => {
      if (!hasQuery) return true;
      if ((options?.vectorScores?.size ?? 0) > 0) {
        return chunk.score > 0.08;
      }
      return chunk.lexicalScore > 0;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  return scored.slice(0, limit);
}

export function buildCitations(
  rankedChunks: RetrievedChunk[],
  query: string,
  max = 5,
): ChatCitation[] {
  return rankedChunks.slice(0, max).map((chunk, index) => ({
    citation_id: `c${index + 1}`,
    noteId: chunk.noteId,
    title: chunk.title,
    sourceType: chunk.sourceType,
    snippet: snippetFromText(chunk.text, query),
    ...(chunk.sourceType === "transcript" &&
    chunk.tStartMs !== undefined &&
    chunk.tEndMs !== undefined
      ? { time_range_optional: `${chunk.tStartMs}..${chunk.tEndMs}` }
      : {}),
  }));
}

export function buildContextBlock(
  citations: ChatCitation[],
  rankedChunks: RetrievedChunk[],
): string {
  const byId = new Map(
    rankedChunks.map((chunk, index) => [`c${index + 1}`, chunk]),
  );

  return citations
    .map((citation) => {
      const chunk = byId.get(citation.citation_id);
      const chunkText = chunk?.text ?? citation.snippet;
      const timeRange = citation.time_range_optional
        ? ` | time: ${citation.time_range_optional}`
        : "";
      return `[${citation.citation_id}] ${citation.title} | source: ${citation.sourceType}${timeRange}\n${chunkText}`;
    })
    .join("\n\n");
}

export function isLowConfidence(rankedChunks: RetrievedChunk[]): boolean {
  const topChunk = rankedChunks[0];
  if (!topChunk) return true;
  return topChunk.score < 0.18;
}

export function noResultsMessage(scope: ChatScope): string {
  const scopeLabel =
    scope === "all_meetings"
      ? "All meetings"
      : scope === "shared_with_me"
        ? "Shared with me"
        : "the current scope";

  return `I couldn't find matching notes in ${scopeLabel}. Try broadening your scope or using different keywords.`;
}

export function lowConfidenceMessage(citations: ChatCitation[]): string {
  const topTitles = citations
    .slice(0, 3)
    .map(
      (citation, index) =>
        `${index + 1}. ${citation.title} [${citation.citation_id}]`,
    )
    .join("\n");

  if (!topTitles) {
    return "I couldn't find enough matching context. Could you clarify what topic or timeframe you want?";
  }

  return `I may be missing context for a precise answer. Could you clarify the topic or timeframe?\n\nClosest notes:\n${topTitles}`;
}
