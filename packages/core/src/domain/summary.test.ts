import { describe, it, expect } from "vitest";
import {
  validateSummaryPayload,
  isSummaryPayload,
  isActionItemsPayload,
  isDecisionsPayload,
  isRisksPayload,
  isKeyPointsPayload,
  isValidConfidence,
} from "./summary";

// ─── validateSummaryPayload: SUMMARY ───

describe("validateSummaryPayload - SUMMARY", () => {
  it("valid payload passes", () => {
    const result = validateSummaryPayload("SUMMARY", {
      title: "Meeting Summary",
      bullets: ["Point 1", "Point 2"],
      oneLiner: "A productive meeting",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing title", () => {
    const result = validateSummaryPayload("SUMMARY", {
      bullets: ["Point 1"],
      oneLiner: "Short",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SUMMARY: missing or invalid 'title'");
  });

  it("rejects missing bullets", () => {
    const result = validateSummaryPayload("SUMMARY", {
      title: "T",
      oneLiner: "Short",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SUMMARY: missing or invalid 'bullets'");
  });

  it("rejects empty bullets array", () => {
    const result = validateSummaryPayload("SUMMARY", {
      title: "T",
      bullets: [],
      oneLiner: "Short",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SUMMARY: 'bullets' must not be empty");
  });

  it("rejects non-string items in bullets", () => {
    const result = validateSummaryPayload("SUMMARY", {
      title: "T",
      bullets: ["valid", 123],
      oneLiner: "Short",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "SUMMARY: 'bullets' must contain only strings",
    );
  });

  it("rejects missing oneLiner", () => {
    const result = validateSummaryPayload("SUMMARY", {
      title: "T",
      bullets: ["A"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SUMMARY: missing or invalid 'oneLiner'");
  });
});

// ─── validateSummaryPayload: ACTION_ITEMS ───

describe("validateSummaryPayload - ACTION_ITEMS", () => {
  it("valid payload passes", () => {
    const result = validateSummaryPayload("ACTION_ITEMS", {
      items: [
        {
          text: "Do thing",
          owner: "Alice",
          due: "2025-07-01",
          confidence: 0.9,
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing items", () => {
    const result = validateSummaryPayload("ACTION_ITEMS", {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("ACTION_ITEMS: missing or invalid 'items'");
  });

  it("rejects items without text", () => {
    const result = validateSummaryPayload("ACTION_ITEMS", {
      items: [{ owner: null, due: null, confidence: 0.5 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "ACTION_ITEMS: item at index 0 missing 'text'",
    );
  });

  it("rejects confidence outside 0..1 range", () => {
    const result = validateSummaryPayload("ACTION_ITEMS", {
      items: [{ text: "Do thing", owner: null, due: null, confidence: 1.5 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "ACTION_ITEMS: item at index 0 has invalid 'confidence'",
    );
  });

  it("accepts owner and due as null", () => {
    const result = validateSummaryPayload("ACTION_ITEMS", {
      items: [{ text: "Do thing", owner: null, due: null, confidence: 0.8 }],
    });
    expect(result.valid).toBe(true);
  });
});

// ─── validateSummaryPayload: DECISIONS ───

describe("validateSummaryPayload - DECISIONS", () => {
  it("valid payload passes", () => {
    const result = validateSummaryPayload("DECISIONS", {
      decisions: ["Use React", "Deploy on Vercel"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing decisions", () => {
    const result = validateSummaryPayload("DECISIONS", {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "DECISIONS: missing or invalid 'decisions'",
    );
  });

  it("rejects non-string items in decisions", () => {
    const result = validateSummaryPayload("DECISIONS", {
      decisions: ["valid", 42],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "DECISIONS: 'decisions' must contain only strings",
    );
  });
});

// ─── validateSummaryPayload: RISKS ───

describe("validateSummaryPayload - RISKS", () => {
  it("valid payload passes", () => {
    const result = validateSummaryPayload("RISKS", {
      risks: ["Budget overrun", "Scope creep"],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing risks", () => {
    const result = validateSummaryPayload("RISKS", {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("RISKS: missing or invalid 'risks'");
  });

  it("rejects non-string items in risks", () => {
    const result = validateSummaryPayload("RISKS", { risks: [true, "ok"] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("RISKS: 'risks' must contain only strings");
  });
});

// ─── validateSummaryPayload: KEY_POINTS ───

describe("validateSummaryPayload - KEY_POINTS", () => {
  it("valid payload passes", () => {
    const result = validateSummaryPayload("KEY_POINTS", {
      keyPoints: ["Point A", "Point B"],
      oneLiner: "Key takeaway",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing keyPoints", () => {
    const result = validateSummaryPayload("KEY_POINTS", {
      oneLiner: "Short",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "KEY_POINTS: missing or invalid 'keyPoints'",
    );
  });

  it("rejects missing oneLiner", () => {
    const result = validateSummaryPayload("KEY_POINTS", {
      keyPoints: ["A"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "KEY_POINTS: missing or invalid 'oneLiner'",
    );
  });
});

// ─── Type guards ───

describe("isSummaryPayload", () => {
  it("returns true for valid shape", () => {
    expect(
      isSummaryPayload({ title: "T", bullets: ["A"], oneLiner: "O" }),
    ).toBe(true);
  });

  it("returns false for missing fields", () => {
    expect(isSummaryPayload({ title: "T" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSummaryPayload(null)).toBe(false);
  });
});

describe("isActionItemsPayload", () => {
  it("returns true for valid shape", () => {
    expect(
      isActionItemsPayload({
        items: [{ text: "X", owner: null, due: null, confidence: 0.5 }],
      }),
    ).toBe(true);
  });

  it("returns false for missing items", () => {
    expect(isActionItemsPayload({})).toBe(false);
  });
});

describe("isDecisionsPayload", () => {
  it("returns true for valid shape", () => {
    expect(isDecisionsPayload({ decisions: ["A"] })).toBe(true);
  });

  it("returns false for missing decisions", () => {
    expect(isDecisionsPayload({})).toBe(false);
  });
});

describe("isRisksPayload", () => {
  it("returns true for valid shape", () => {
    expect(isRisksPayload({ risks: ["R"] })).toBe(true);
  });

  it("returns false for missing risks", () => {
    expect(isRisksPayload({})).toBe(false);
  });
});

describe("isKeyPointsPayload", () => {
  it("returns true for valid shape", () => {
    expect(isKeyPointsPayload({ keyPoints: ["A"], oneLiner: "O" })).toBe(true);
  });

  it("returns false for missing fields", () => {
    expect(isKeyPointsPayload({ keyPoints: ["A"] })).toBe(false);
  });
});

// ─── isValidConfidence ───

describe("isValidConfidence", () => {
  it("returns true for 0", () => {
    expect(isValidConfidence(0)).toBe(true);
  });

  it("returns true for 0.5", () => {
    expect(isValidConfidence(0.5)).toBe(true);
  });

  it("returns true for 1", () => {
    expect(isValidConfidence(1)).toBe(true);
  });

  it("returns false for -0.1", () => {
    expect(isValidConfidence(-0.1)).toBe(false);
  });

  it("returns false for 1.1", () => {
    expect(isValidConfidence(1.1)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isValidConfidence(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isValidConfidence(Infinity)).toBe(false);
  });
});
