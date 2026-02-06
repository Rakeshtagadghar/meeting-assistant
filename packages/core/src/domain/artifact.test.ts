import { describe, it, expect } from "vitest";
import type {
  UUID,
  ISODateString,
  CreateArtifactInput,
  NoteArtifact,
} from "./types";
import { ArtifactType, ArtifactStatus } from "./types";
import {
  createArtifact,
  startGeneratingArtifact,
  completeArtifact,
  failArtifact,
  canDownload,
  isExportAllowed,
  isValidArtifactTransition,
} from "./artifact";

// ─── Helpers ───

const uuid = (s: string) => s as UUID;
const iso = (s: string) => s as ISODateString;

function makeArtifactInput(
  overrides?: Partial<CreateArtifactInput>,
): CreateArtifactInput {
  return {
    noteId: uuid("note-1"),
    jobId: uuid("job-1"),
    type: ArtifactType.MARKDOWN_SUMMARY,
    ...overrides,
  };
}

function makeArtifact(overrides?: Partial<NoteArtifact>): NoteArtifact {
  return {
    id: uuid("art-1"),
    noteId: uuid("note-1"),
    jobId: uuid("job-1"),
    type: ArtifactType.MARKDOWN_SUMMARY,
    status: ArtifactStatus.NOT_READY,
    storagePath: null,
    hash: null,
    createdAt: iso("2025-01-01T00:00:00.000Z"),
    updatedAt: iso("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const NOW = iso("2025-01-01T00:00:00.000Z");
const LATER = iso("2025-01-01T00:01:00.000Z");
const EVEN_LATER = iso("2025-01-01T00:02:00.000Z");

// ─── createArtifact ───

describe("createArtifact", () => {
  it("creates a NOT_READY artifact with defaults", () => {
    const artifact = createArtifact(makeArtifactInput(), uuid("art-1"), NOW);

    expect(artifact.id).toBe("art-1");
    expect(artifact.noteId).toBe("note-1");
    expect(artifact.jobId).toBe("job-1");
    expect(artifact.type).toBe(ArtifactType.MARKDOWN_SUMMARY);
    expect(artifact.status).toBe(ArtifactStatus.NOT_READY);
    expect(artifact.storagePath).toBeNull();
    expect(artifact.hash).toBeNull();
    expect(artifact.createdAt).toBe(NOW);
    expect(artifact.updatedAt).toBe(NOW);
  });

  it("respects provided type", () => {
    const artifact = createArtifact(
      makeArtifactInput({ type: ArtifactType.PDF }),
      uuid("art-2"),
      NOW,
    );
    expect(artifact.type).toBe(ArtifactType.PDF);
  });
});

// ─── startGeneratingArtifact ───

describe("startGeneratingArtifact", () => {
  it("transitions NOT_READY → GENERATING", () => {
    const artifact = createArtifact(makeArtifactInput(), uuid("art-1"), NOW);
    const generating = startGeneratingArtifact(artifact, LATER);

    expect(generating.status).toBe(ArtifactStatus.GENERATING);
    expect(generating.updatedAt).toBe(LATER);
  });

  it("throws on invalid transition from READY", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.READY });
    expect(() => startGeneratingArtifact(artifact, LATER)).toThrow(
      /invalid transition/i,
    );
  });

  it("throws on invalid transition from FAILED", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.FAILED });
    expect(() => startGeneratingArtifact(artifact, LATER)).toThrow(
      /invalid transition/i,
    );
  });
});

// ─── completeArtifact ───

describe("completeArtifact", () => {
  it("transitions GENERATING → READY with storagePath and hash", () => {
    const artifact = createArtifact(makeArtifactInput(), uuid("art-1"), NOW);
    const generating = startGeneratingArtifact(artifact, LATER);
    const completed = completeArtifact(
      generating,
      "/exports/summary.md",
      "abc123",
      EVEN_LATER,
    );

    expect(completed.status).toBe(ArtifactStatus.READY);
    expect(completed.storagePath).toBe("/exports/summary.md");
    expect(completed.hash).toBe("abc123");
    expect(completed.updatedAt).toBe(EVEN_LATER);
  });

  it("throws on invalid transition from NOT_READY", () => {
    const artifact = createArtifact(makeArtifactInput(), uuid("art-1"), NOW);
    expect(() => completeArtifact(artifact, "/path", "hash", LATER)).toThrow(
      /invalid transition/i,
    );
  });
});

// ─── failArtifact ───

describe("failArtifact", () => {
  it("transitions GENERATING → FAILED", () => {
    const artifact = createArtifact(makeArtifactInput(), uuid("art-1"), NOW);
    const generating = startGeneratingArtifact(artifact, LATER);
    const failed = failArtifact(generating, EVEN_LATER);

    expect(failed.status).toBe(ArtifactStatus.FAILED);
    expect(failed.updatedAt).toBe(EVEN_LATER);
  });

  it("throws on invalid transition from NOT_READY", () => {
    const artifact = createArtifact(makeArtifactInput(), uuid("art-1"), NOW);
    expect(() => failArtifact(artifact, LATER)).toThrow(/invalid transition/i);
  });

  it("throws on invalid transition from READY", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.READY });
    expect(() => failArtifact(artifact, LATER)).toThrow(/invalid transition/i);
  });
});

// ─── canDownload ───

describe("canDownload", () => {
  it("returns true for READY artifacts", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.READY });
    expect(canDownload(artifact)).toBe(true);
  });

  it("returns false for NOT_READY artifacts", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.NOT_READY });
    expect(canDownload(artifact)).toBe(false);
  });

  it("returns false for GENERATING artifacts", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.GENERATING });
    expect(canDownload(artifact)).toBe(false);
  });

  it("returns false for FAILED artifacts", () => {
    const artifact = makeArtifact({ status: ArtifactStatus.FAILED });
    expect(canDownload(artifact)).toBe(false);
  });
});

// ─── isExportAllowed ───

describe("isExportAllowed", () => {
  it("returns true when HTML_SUMMARY is READY", () => {
    const artifacts: NoteArtifact[] = [
      makeArtifact({
        type: ArtifactType.HTML_SUMMARY,
        status: ArtifactStatus.READY,
      }),
    ];
    expect(isExportAllowed(artifacts)).toBe(true);
  });

  it("returns false when HTML_SUMMARY is NOT_READY", () => {
    const artifacts: NoteArtifact[] = [
      makeArtifact({
        type: ArtifactType.HTML_SUMMARY,
        status: ArtifactStatus.NOT_READY,
      }),
    ];
    expect(isExportAllowed(artifacts)).toBe(false);
  });

  it("returns false when HTML_SUMMARY is GENERATING", () => {
    const artifacts: NoteArtifact[] = [
      makeArtifact({
        type: ArtifactType.HTML_SUMMARY,
        status: ArtifactStatus.GENERATING,
      }),
    ];
    expect(isExportAllowed(artifacts)).toBe(false);
  });

  it("returns false when no HTML_SUMMARY exists", () => {
    const artifacts: NoteArtifact[] = [
      makeArtifact({
        type: ArtifactType.MARKDOWN_SUMMARY,
        status: ArtifactStatus.READY,
      }),
    ];
    expect(isExportAllowed(artifacts)).toBe(false);
  });

  it("returns false for empty artifacts list", () => {
    expect(isExportAllowed([])).toBe(false);
  });

  it("returns true when HTML_SUMMARY is READY among other artifacts", () => {
    const artifacts: NoteArtifact[] = [
      makeArtifact({
        type: ArtifactType.MARKDOWN_SUMMARY,
        status: ArtifactStatus.READY,
      }),
      makeArtifact({
        type: ArtifactType.HTML_SUMMARY,
        status: ArtifactStatus.READY,
      }),
      makeArtifact({
        type: ArtifactType.PDF,
        status: ArtifactStatus.NOT_READY,
      }),
    ];
    expect(isExportAllowed(artifacts)).toBe(true);
  });
});

// ─── isValidArtifactTransition ───

describe("isValidArtifactTransition", () => {
  it("allows NOT_READY → GENERATING", () => {
    expect(
      isValidArtifactTransition(
        ArtifactStatus.NOT_READY,
        ArtifactStatus.GENERATING,
      ),
    ).toBe(true);
  });

  it("allows GENERATING → READY", () => {
    expect(
      isValidArtifactTransition(
        ArtifactStatus.GENERATING,
        ArtifactStatus.READY,
      ),
    ).toBe(true);
  });

  it("allows GENERATING → FAILED", () => {
    expect(
      isValidArtifactTransition(
        ArtifactStatus.GENERATING,
        ArtifactStatus.FAILED,
      ),
    ).toBe(true);
  });

  it("rejects NOT_READY → READY", () => {
    expect(
      isValidArtifactTransition(ArtifactStatus.NOT_READY, ArtifactStatus.READY),
    ).toBe(false);
  });

  it("rejects READY → GENERATING", () => {
    expect(
      isValidArtifactTransition(
        ArtifactStatus.READY,
        ArtifactStatus.GENERATING,
      ),
    ).toBe(false);
  });

  it("rejects FAILED → GENERATING", () => {
    expect(
      isValidArtifactTransition(
        ArtifactStatus.FAILED,
        ArtifactStatus.GENERATING,
      ),
    ).toBe(false);
  });
});
