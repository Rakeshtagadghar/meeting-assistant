import type {
  TranscriptChunk,
  CreateTranscriptChunkInput,
  UUID,
  ISODateString,
} from "./types";

export function createTranscriptChunk(
  input: CreateTranscriptChunkInput,
  id: UUID,
  now: ISODateString,
): TranscriptChunk {
  if (!isValidChunkTiming(input.tStartMs, input.tEndMs)) {
    throw new Error("Invalid chunk timing");
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new Error("sequence must be a non-negative integer");
  }
  return {
    id,
    meetingSessionId: input.meetingSessionId,
    sequence: input.sequence,
    tStartMs: input.tStartMs,
    tEndMs: input.tEndMs,
    speaker: input.speaker,
    text: input.text,
    confidence: input.confidence,
    createdAt: now,
  };
}

export function sortChunks(
  chunks: readonly TranscriptChunk[],
): TranscriptChunk[] {
  return [...chunks].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    if (a.tStartMs !== b.tStartMs) return a.tStartMs - b.tStartMs;
    return a.tEndMs - b.tEndMs;
  });
}

export function isValidChunkTiming(tStartMs: number, tEndMs: number): boolean {
  return (
    Number.isFinite(tStartMs) &&
    Number.isFinite(tEndMs) &&
    tStartMs >= 0 &&
    tEndMs > tStartMs
  );
}

export function mergeAdjacentChunks(
  chunks: readonly TranscriptChunk[],
  toleranceMs: number = 500,
): TranscriptChunk[] {
  const sorted = sortChunks(chunks);
  if (sorted.length === 0) return [];

  const result: TranscriptChunk[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = result[result.length - 1]!;

    const sameSpeaker =
      last.speaker !== null &&
      current.speaker !== null &&
      last.speaker === current.speaker;

    const withinTolerance = current.tStartMs - last.tEndMs <= toleranceMs;

    if (sameSpeaker && withinTolerance) {
      result[result.length - 1] = {
        ...last,
        tEndMs: current.tEndMs,
        text: `${last.text} ${current.text}`,
      };
    } else {
      result.push(current);
    }
  }

  return result;
}

export function buildTranscriptText(
  chunks: readonly TranscriptChunk[],
): string {
  if (chunks.length === 0) return "";

  const sorted = sortChunks(chunks);
  return sorted.map((c) => `[${c.speaker ?? "Unknown"}]: ${c.text}`).join("\n");
}

export function chunksInRange(
  chunks: readonly TranscriptChunk[],
  startMs: number,
  endMs: number,
): TranscriptChunk[] {
  return chunks.filter((c) => c.tStartMs < endMs && c.tEndMs > startMs);
}
