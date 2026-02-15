import type { Prisma } from "@prisma/client";

export interface NoteForRag {
  id: string;
  title: string;
  contentPlain: string;
  updatedAt: Date;
  createdAt: Date;
  meetingSessions: Array<{
    id: string;
    startedAt: Date;
    transcriptChunks: Array<{
      id: string;
      text: string;
      tStartMs: number;
      tEndMs: number;
      createdAt: Date;
    }>;
  }>;
  summaries: Array<{
    id: string;
    kind: string;
    payload: Prisma.JsonValue;
    createdAt: Date;
  }>;
}

export interface RagChunk {
  id: string;
  noteId: string;
  title: string;
  sourceType: "note" | "transcript" | "summary";
  text: string;
  updatedAt: Date;
  tStartMs?: number;
  tEndMs?: number;
}

const TARGET_CHARS = 1400;
const OVERLAP_CHARS = 220;

function payloadToText(payload: Prisma.JsonValue): string {
  if (typeof payload === "string") return payload;

  if (Array.isArray(payload)) {
    return payload.map(payloadToText).join(" ");
  }

  if (payload && typeof payload === "object") {
    return Object.values(payload as Record<string, Prisma.JsonValue>)
      .map(payloadToText)
      .join(" ");
  }

  return "";
}

function normalizeText(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function splitIntoChunks(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (normalized.length <= TARGET_CHARS) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + TARGET_CHARS, normalized.length);
    if (end < normalized.length) {
      const lastBoundary = Math.max(
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("! ", end),
        normalized.lastIndexOf("? ", end),
      );
      if (lastBoundary > start + Math.floor(TARGET_CHARS * 0.5)) {
        end = lastBoundary + 1;
      }
    }

    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

export function extractRagChunks(notes: NoteForRag[]): RagChunk[] {
  const chunks: RagChunk[] = [];

  for (const note of notes) {
    const title = note.title || "Untitled note";
    const noteParts = splitIntoChunks(note.contentPlain);

    noteParts.forEach((text, index) => {
      chunks.push({
        id: `note:${note.id}:${index}`,
        noteId: note.id,
        title,
        sourceType: "note",
        text,
        updatedAt: note.updatedAt,
      });
    });

    for (const summary of note.summaries) {
      const summaryText = payloadToText(summary.payload);
      const summaryParts = splitIntoChunks(summaryText);

      summaryParts.forEach((text, index) => {
        chunks.push({
          id: `summary:${summary.id}:${index}`,
          noteId: note.id,
          title,
          sourceType: "summary",
          text,
          updatedAt: summary.createdAt,
        });
      });
    }

    for (const session of note.meetingSessions) {
      for (const transcript of session.transcriptChunks) {
        const text = normalizeText(transcript.text);
        if (!text) continue;

        chunks.push({
          id: `transcript:${transcript.id}`,
          noteId: note.id,
          title,
          sourceType: "transcript",
          text,
          updatedAt: transcript.createdAt,
          tStartMs: transcript.tStartMs,
          tEndMs: transcript.tEndMs,
        });
      }
    }
  }

  return chunks;
}
