import { describe, it, expect } from "vitest";
import type { TranscriptChunk, UUID, ISODateString } from "./types";
import {
  createTranscriptChunk,
  sortChunks,
  mergeAdjacentChunks,
  buildTranscriptText,
  isValidChunkTiming,
  chunksInRange,
} from "./transcript";

// ─── Fixture factory ───

let counter = 0;
function makeChunk(overrides: Partial<TranscriptChunk> = {}): TranscriptChunk {
  counter += 1;
  return {
    id: `chunk-${String(counter)}` as UUID,
    meetingSessionId: "session-1" as UUID,
    sequence: 0,
    tStartMs: 0,
    tEndMs: 1000,
    speaker: "Alice",
    prosodyEnergy: null,
    prosodyPauseRatio: null,
    prosodyVoicedMs: null,
    prosodySnrDb: null,
    prosodyQualityPass: null,
    prosodyToneWeightsEnabled: null,
    prosodyConfidencePenalty: null,
    prosodyClientEnergy: null,
    prosodyClientStress: null,
    prosodyClientCertainty: null,
    text: `chunk text ${String(counter)}`,
    confidence: null,
    createdAt: "2025-01-01T00:00:00Z" as ISODateString,
    ...overrides,
  };
}

const NOW = "2025-06-15T12:00:00.000Z" as ISODateString;

// ─── createTranscriptChunk ───

describe("createTranscriptChunk", () => {
  it("creates a chunk with all fields", () => {
    const chunk = createTranscriptChunk(
      {
        meetingSessionId: "session-1" as UUID,
        sequence: 0,
        tStartMs: 0,
        tEndMs: 1000,
        speaker: "Alice",
        text: "Hello",
        confidence: 0.95,
      },
      "chunk-id" as UUID,
      NOW,
    );

    expect(chunk.id).toBe("chunk-id");
    expect(chunk.meetingSessionId).toBe("session-1");
    expect(chunk.sequence).toBe(0);
    expect(chunk.tStartMs).toBe(0);
    expect(chunk.tEndMs).toBe(1000);
    expect(chunk.speaker).toBe("Alice");
    expect(chunk.text).toBe("Hello");
    expect(chunk.confidence).toBe(0.95);
    expect(chunk.createdAt).toBe(NOW);
  });

  it("allows null speaker and null confidence", () => {
    const chunk = createTranscriptChunk(
      {
        meetingSessionId: "session-1" as UUID,
        sequence: 1,
        tStartMs: 1000,
        tEndMs: 2000,
        speaker: null,
        text: "Some text",
        confidence: null,
      },
      "chunk-id-2" as UUID,
      NOW,
    );

    expect(chunk.speaker).toBeNull();
    expect(chunk.confidence).toBeNull();
  });

  it("throws on invalid timing", () => {
    expect(() =>
      createTranscriptChunk(
        {
          meetingSessionId: "session-1" as UUID,
          sequence: 0,
          tStartMs: 1000,
          tEndMs: 500,
          speaker: null,
          text: "Bad timing",
          confidence: null,
        },
        "chunk-id" as UUID,
        NOW,
      ),
    ).toThrow("Invalid chunk timing");
  });

  it("throws on negative sequence", () => {
    expect(() =>
      createTranscriptChunk(
        {
          meetingSessionId: "session-1" as UUID,
          sequence: -1,
          tStartMs: 0,
          tEndMs: 1000,
          speaker: null,
          text: "Negative seq",
          confidence: null,
        },
        "chunk-id" as UUID,
        NOW,
      ),
    ).toThrow("sequence must be a non-negative integer");
  });

  it("throws on non-integer sequence", () => {
    expect(() =>
      createTranscriptChunk(
        {
          meetingSessionId: "session-1" as UUID,
          sequence: 1.5,
          tStartMs: 0,
          tEndMs: 1000,
          speaker: null,
          text: "Float seq",
          confidence: null,
        },
        "chunk-id" as UUID,
        NOW,
      ),
    ).toThrow("sequence must be a non-negative integer");
  });
});

// ─── sortChunks ───

describe("sortChunks", () => {
  it("sorts by tStartMs ascending", () => {
    const c1 = makeChunk({ tStartMs: 3000, tEndMs: 4000 });
    const c2 = makeChunk({ tStartMs: 1000, tEndMs: 2000 });
    const c3 = makeChunk({ tStartMs: 2000, tEndMs: 3000 });

    const sorted = sortChunks([c1, c2, c3]);
    expect(sorted.map((c) => c.tStartMs)).toEqual([1000, 2000, 3000]);
  });

  it("uses tEndMs as tiebreaker when tStartMs is equal", () => {
    const c1 = makeChunk({ tStartMs: 1000, tEndMs: 3000 });
    const c2 = makeChunk({ tStartMs: 1000, tEndMs: 2000 });

    const sorted = sortChunks([c1, c2]);
    expect(sorted[0]!.tEndMs).toBe(2000);
    expect(sorted[1]!.tEndMs).toBe(3000);
  });

  it("returns empty array for empty input", () => {
    expect(sortChunks([])).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const c1 = makeChunk({ tStartMs: 2000, tEndMs: 3000 });
    const c2 = makeChunk({ tStartMs: 1000, tEndMs: 2000 });
    const original = [c1, c2];
    sortChunks(original);
    expect(original[0]).toBe(c1);
    expect(original[1]).toBe(c2);
  });

  it("handles single-element array", () => {
    const c1 = makeChunk({ tStartMs: 5000, tEndMs: 6000 });
    expect(sortChunks([c1])).toEqual([c1]);
  });

  it("sorts by sequence as primary key", () => {
    const c1 = makeChunk({ sequence: 3, tStartMs: 0, tEndMs: 1000 });
    const c2 = makeChunk({ sequence: 1, tStartMs: 2000, tEndMs: 3000 });
    const c3 = makeChunk({ sequence: 2, tStartMs: 1000, tEndMs: 2000 });

    const sorted = sortChunks([c1, c2, c3]);
    expect(sorted.map((c) => c.sequence)).toEqual([1, 2, 3]);
  });

  it("uses tStartMs as tiebreaker when sequence is equal", () => {
    const c1 = makeChunk({ sequence: 1, tStartMs: 3000, tEndMs: 4000 });
    const c2 = makeChunk({ sequence: 1, tStartMs: 1000, tEndMs: 2000 });

    const sorted = sortChunks([c1, c2]);
    expect(sorted[0]!.tStartMs).toBe(1000);
    expect(sorted[1]!.tStartMs).toBe(3000);
  });
});

// ─── mergeAdjacentChunks ───

describe("mergeAdjacentChunks", () => {
  it("merges chunks from same speaker within tolerance", () => {
    const c1 = makeChunk({
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "Hello",
    });
    const c2 = makeChunk({
      speaker: "Alice",
      tStartMs: 1200,
      tEndMs: 2000,
      text: "World",
    });

    const merged = mergeAdjacentChunks([c1, c2], 500);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe("Hello World");
    expect(merged[0]!.tStartMs).toBe(0);
    expect(merged[0]!.tEndMs).toBe(2000);
  });

  it("does not merge chunks from different speakers", () => {
    const c1 = makeChunk({
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "Hello",
    });
    const c2 = makeChunk({
      speaker: "Bob",
      tStartMs: 1200,
      tEndMs: 2000,
      text: "World",
    });

    const merged = mergeAdjacentChunks([c1, c2], 500);
    expect(merged).toHaveLength(2);
  });

  it("does not merge when gap exceeds tolerance", () => {
    const c1 = makeChunk({
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "Hello",
    });
    const c2 = makeChunk({
      speaker: "Alice",
      tStartMs: 2000,
      tEndMs: 3000,
      text: "World",
    });

    const merged = mergeAdjacentChunks([c1, c2], 500);
    expect(merged).toHaveLength(2);
  });

  it("uses default tolerance of 500ms", () => {
    const c1 = makeChunk({
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "Hello",
    });
    const c2 = makeChunk({
      speaker: "Alice",
      tStartMs: 1400,
      tEndMs: 2000,
      text: "World",
    });

    const merged = mergeAdjacentChunks([c1, c2]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe("Hello World");
  });

  it("keeps first chunk's id and createdAt when merging", () => {
    const c1 = makeChunk({
      id: "first-id" as UUID,
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "Hello",
      createdAt: "2025-01-01T00:00:00Z" as ISODateString,
    });
    const c2 = makeChunk({
      id: "second-id" as UUID,
      speaker: "Alice",
      tStartMs: 1200,
      tEndMs: 2000,
      text: "World",
      createdAt: "2025-01-01T00:01:00Z" as ISODateString,
    });

    const merged = mergeAdjacentChunks([c1, c2], 500);
    expect(merged[0]!.id).toBe("first-id");
    expect(merged[0]!.createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("merges three consecutive same-speaker chunks", () => {
    const c1 = makeChunk({
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "A",
    });
    const c2 = makeChunk({
      speaker: "Alice",
      tStartMs: 1200,
      tEndMs: 2000,
      text: "B",
    });
    const c3 = makeChunk({
      speaker: "Alice",
      tStartMs: 2300,
      tEndMs: 3000,
      text: "C",
    });

    const merged = mergeAdjacentChunks([c1, c2, c3], 500);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe("A B C");
    expect(merged[0]!.tEndMs).toBe(3000);
  });

  it("handles null speakers — does not merge nulls", () => {
    const c1 = makeChunk({
      speaker: null,
      tStartMs: 0,
      tEndMs: 1000,
      text: "A",
    });
    const c2 = makeChunk({
      speaker: null,
      tStartMs: 1200,
      tEndMs: 2000,
      text: "B",
    });

    const merged = mergeAdjacentChunks([c1, c2], 500);
    expect(merged).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(mergeAdjacentChunks([])).toEqual([]);
  });

  it("sorts chunks before merging", () => {
    const c1 = makeChunk({
      speaker: "Alice",
      tStartMs: 1200,
      tEndMs: 2000,
      text: "World",
    });
    const c2 = makeChunk({
      speaker: "Alice",
      tStartMs: 0,
      tEndMs: 1000,
      text: "Hello",
    });

    const merged = mergeAdjacentChunks([c1, c2], 500);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe("Hello World");
  });
});

// ─── buildTranscriptText ───

describe("buildTranscriptText", () => {
  it("formats as '[speaker]: text' lines", () => {
    const c1 = makeChunk({ speaker: "Alice", text: "Hello" });
    const c2 = makeChunk({ speaker: "Bob", text: "Hi there" });

    const text = buildTranscriptText([c1, c2]);
    expect(text).toBe("[Alice]: Hello\n[Bob]: Hi there");
  });

  it("uses 'Unknown' for null speaker", () => {
    const c1 = makeChunk({ speaker: null, text: "Some text" });

    const text = buildTranscriptText([c1]);
    expect(text).toBe("[Unknown]: Some text");
  });

  it("returns empty string for empty input", () => {
    expect(buildTranscriptText([])).toBe("");
  });

  it("sorts chunks before building text", () => {
    const c1 = makeChunk({
      speaker: "Bob",
      text: "Second",
      tStartMs: 2000,
      tEndMs: 3000,
    });
    const c2 = makeChunk({
      speaker: "Alice",
      text: "First",
      tStartMs: 0,
      tEndMs: 1000,
    });

    const text = buildTranscriptText([c1, c2]);
    expect(text).toBe("[Alice]: First\n[Bob]: Second");
  });
});

// ─── isValidChunkTiming ───

describe("isValidChunkTiming", () => {
  it("returns true for valid timing", () => {
    expect(isValidChunkTiming(0, 1000)).toBe(true);
  });

  it("returns true for tStartMs = 0", () => {
    expect(isValidChunkTiming(0, 1)).toBe(true);
  });

  it("returns false for negative tStartMs", () => {
    expect(isValidChunkTiming(-1, 1000)).toBe(false);
  });

  it("returns false when tEndMs <= tStartMs", () => {
    expect(isValidChunkTiming(1000, 1000)).toBe(false);
    expect(isValidChunkTiming(1000, 500)).toBe(false);
  });

  it("returns false for NaN values", () => {
    expect(isValidChunkTiming(NaN, 1000)).toBe(false);
    expect(isValidChunkTiming(0, NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isValidChunkTiming(0, Infinity)).toBe(false);
    expect(isValidChunkTiming(Infinity, 1000)).toBe(false);
  });
});

// ─── chunksInRange ───

describe("chunksInRange", () => {
  const c1 = makeChunk({ tStartMs: 0, tEndMs: 1000 });
  const c2 = makeChunk({ tStartMs: 1000, tEndMs: 2000 });
  const c3 = makeChunk({ tStartMs: 2000, tEndMs: 3000 });
  const c4 = makeChunk({ tStartMs: 3000, tEndMs: 4000 });
  const all = [c1, c2, c3, c4];

  it("returns chunks that overlap with the range", () => {
    const result = chunksInRange(all, 500, 2500);
    expect(result).toHaveLength(3);
    expect(result).toContain(c1);
    expect(result).toContain(c2);
    expect(result).toContain(c3);
  });

  it("includes chunks that start before range but end within", () => {
    const result = chunksInRange(all, 500, 1500);
    expect(result).toContain(c1);
    expect(result).toContain(c2);
  });

  it("includes chunks that start within range but end after", () => {
    const result = chunksInRange(all, 2500, 3500);
    expect(result).toContain(c3);
    expect(result).toContain(c4);
  });

  it("excludes chunks entirely outside the range", () => {
    const result = chunksInRange(all, 500, 1500);
    expect(result).not.toContain(c3);
    expect(result).not.toContain(c4);
  });

  it("returns empty array when no chunks match", () => {
    expect(chunksInRange(all, 5000, 6000)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(chunksInRange([], 0, 1000)).toEqual([]);
  });
});
