import { describe, it, expect } from "vitest";
import { extractiveSummarize } from "./extractive";

describe("extractiveSummarize", () => {
  it("returns bullets from first sentences", () => {
    const text = "First sentence. Second sentence. Third sentence. Fourth.";
    const result = extractiveSummarize(text);
    expect(result.bullets).toHaveLength(3);
    expect(result.bullets[0]).toBe("First sentence");
  });

  it("returns oneLiner as first sentence", () => {
    const text = "The meeting was productive. Action items assigned.";
    const result = extractiveSummarize(text);
    expect(result.oneLiner).toBe("The meeting was productive");
  });

  it("handles empty text", () => {
    const result = extractiveSummarize("");
    expect(result.bullets).toHaveLength(0);
    expect(result.oneLiner).toBe("");
  });
});
