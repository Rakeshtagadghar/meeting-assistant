import type { EvidenceSnippet, TemplateSectionSpec } from "@ainotes/ai";
import { buildSectionQuery } from "@ainotes/ai";
import {
  queryVectorSimilarityScores,
  isSemanticSearchEnabled,
} from "@/lib/chat/vector-store";
import { extractRagChunks, type NoteForRag } from "@/lib/chat/chunks";

interface EvidenceRetrievalResult {
  evidenceBySection: Record<string, EvidenceSnippet[]>;
}

/**
 * Retrieves evidence chunks for each template section using the existing
 * pgvector similarity search. Falls back to full-text chunks if semantic
 * search is not enabled.
 */
export async function retrieveEvidenceForSections(
  userId: string,
  noteIds: string[],
  notes: NoteForRag[],
  templateSections: TemplateSectionSpec[],
  meetingTitle: string,
  topK = 10,
): Promise<EvidenceRetrievalResult> {
  const allChunks = extractRagChunks(notes);
  const evidenceBySection: Record<string, EvidenceSnippet[]> = {};

  if (!isSemanticSearchEnabled() || allChunks.length === 0) {
    // Fallback: use all chunks as global evidence
    const globalEvidence: EvidenceSnippet[] = allChunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      sourceType: chunk.sourceType,
      text: chunk.text,
      timeRange:
        chunk.tStartMs !== undefined && chunk.tEndMs !== undefined
          ? `${chunk.tStartMs}..${chunk.tEndMs}`
          : undefined,
    }));
    evidenceBySection["*"] = globalEvidence.slice(0, topK * 3);
    return { evidenceBySection };
  }

  // For each template section, build a query and retrieve relevant chunks
  for (const section of templateSections) {
    const query = buildSectionQuery(section.key, section.title, meetingTitle);
    const scoreMap = await queryVectorSimilarityScores(
      userId,
      noteIds,
      query,
      topK,
    );

    // Map scores back to full chunk data
    const scoredChunks = allChunks
      .filter((chunk) => scoreMap.has(chunk.id))
      .map((chunk) => ({
        chunk,
        score: scoreMap.get(chunk.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    evidenceBySection[section.key] = scoredChunks.map(({ chunk, score }) => ({
      id: chunk.id,
      title: chunk.title,
      sourceType: chunk.sourceType,
      text: chunk.text,
      timeRange:
        chunk.tStartMs !== undefined && chunk.tEndMs !== undefined
          ? `${chunk.tStartMs}..${chunk.tEndMs}`
          : undefined,
      score,
    }));
  }

  return { evidenceBySection };
}
