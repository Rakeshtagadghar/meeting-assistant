import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { RagChunk } from "./chunks";
import {
  embedTextsWithGoogle,
  getGoogleEmbeddingsApiKey,
} from "./google-embeddings";

interface ChunkHashRow {
  chunk_key: string;
  content_hash: string;
}

interface SimilarityRow {
  chunk_key: string;
  similarity: number;
}

function getChunkIndex(chunkKey: string): number {
  const parts = chunkKey.split(":");
  const maybeIndex = parts[parts.length - 1];
  const parsed = maybeIndex ? Number(maybeIndex) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function vectorToLiteral(vector: number[]): string {
  const safeValues = vector.map((value) =>
    Number.isFinite(value) ? Number(value).toFixed(8) : "0.00000000",
  );
  return `[${safeValues.join(",")}]`;
}

export function isSemanticSearchEnabled(): boolean {
  return Boolean(getGoogleEmbeddingsApiKey());
}

export async function syncNoteChunksToVectorStore(
  userId: string,
  chunks: RagChunk[],
): Promise<void> {
  if (!isSemanticSearchEnabled() || chunks.length === 0) return;

  const noteIds = [...new Set(chunks.map((chunk) => chunk.noteId))];
  if (noteIds.length === 0) return;

  const existingRows = await prisma.$queryRawUnsafe<ChunkHashRow[]>(
    `
    SELECT chunk_key, content_hash
    FROM note_chunks
    WHERE user_id = $1::uuid
      AND note_id = ANY($2::uuid[])
    `,
    userId,
    noteIds,
  );
  const existingByKey = new Map(
    existingRows.map((row) => [row.chunk_key, row.content_hash]),
  );
  const nextKeys = new Set(chunks.map((chunk) => chunk.id));

  const keysToDelete = existingRows
    .map((row) => row.chunk_key)
    .filter((key) => !nextKeys.has(key));

  if (keysToDelete.length > 0) {
    await prisma.$executeRawUnsafe(
      `
      DELETE FROM note_chunks
      WHERE user_id = $1::uuid
        AND chunk_key = ANY($2::text[])
      `,
      userId,
      keysToDelete,
    );
  }

  const toUpsert = chunks.filter((chunk) => {
    const contentHash = hashText(chunk.text);
    return existingByKey.get(chunk.id) !== contentHash;
  });

  if (toUpsert.length === 0) return;

  const embeddings = await embedTextsWithGoogle(
    toUpsert.map((chunk) => chunk.text),
    "RETRIEVAL_DOCUMENT",
  );

  for (let i = 0; i < toUpsert.length; i += 1) {
    const chunk = toUpsert[i];
    const embedding = embeddings[i];
    if (!chunk || !embedding) continue;
    const contentHash = hashText(chunk.text);
    const vectorLiteral = vectorToLiteral(embedding);

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO note_chunks (
        user_id,
        note_id,
        source_type,
        chunk_key,
        chunk_index,
        title,
        content,
        content_hash,
        t_start_ms,
        t_end_ms,
        embedding,
        updated_at
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11::vector,
        NOW()
      )
      ON CONFLICT (chunk_key) DO UPDATE
      SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        content_hash = EXCLUDED.content_hash,
        t_start_ms = EXCLUDED.t_start_ms,
        t_end_ms = EXCLUDED.t_end_ms,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
      `,
      userId,
      chunk.noteId,
      chunk.sourceType,
      chunk.id,
      getChunkIndex(chunk.id),
      chunk.title,
      chunk.text,
      contentHash,
      chunk.tStartMs ?? null,
      chunk.tEndMs ?? null,
      vectorLiteral,
    );
  }
}

export async function queryVectorSimilarityScores(
  userId: string,
  noteIds: string[],
  query: string,
  limit = 50,
): Promise<Map<string, number>> {
  if (!isSemanticSearchEnabled()) return new Map();
  if (!query.trim() || noteIds.length === 0) return new Map();

  const [queryEmbedding] = await embedTextsWithGoogle(
    [query],
    "RETRIEVAL_QUERY",
  );
  if (!queryEmbedding) return new Map();

  const vectorLiteral = vectorToLiteral(queryEmbedding);

  const rows = await prisma.$queryRawUnsafe<SimilarityRow[]>(
    `
    SELECT chunk_key, (1 - (embedding <=> $3::vector)) AS similarity
    FROM note_chunks
    WHERE user_id = $1::uuid
      AND note_id = ANY($2::uuid[])
    ORDER BY embedding <=> $3::vector
    LIMIT $4
    `,
    userId,
    noteIds,
    vectorLiteral,
    limit,
  );

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.chunk_key, Number(row.similarity) || 0);
  }

  return map;
}
