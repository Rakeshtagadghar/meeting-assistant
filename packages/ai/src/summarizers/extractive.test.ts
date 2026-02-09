import { describe, it, expect } from "vitest";
import { extractiveSummarize } from "./extractive";

describe("extractiveSummarize", () => {
  it("handles empty text", () => {
    const result = extractiveSummarize("");
    expect(result.bullets).toHaveLength(0);
    expect(result.oneLiner).toBe("");
    expect(result.sections).toHaveLength(0);
    expect(result.nextSteps).toHaveLength(0);
  });

  it("handles whitespace-only text", () => {
    const result = extractiveSummarize("   \n\n  ");
    expect(result.bullets).toHaveLength(0);
    expect(result.oneLiner).toBe("");
  });

  it("extracts sections from multi-topic text", () => {
    const text = [
      "We discussed the new database migration strategy for the project.",
      "The database needs to support PostgreSQL and MySQL.",
      "We also talked about the frontend redesign initiative.",
      "The frontend should use React and Tailwind CSS for styling.",
      "Performance optimization was another key topic.",
      "We should optimize the API response times significantly.",
    ].join(" ");

    const result = extractiveSummarize(text);
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
    expect(result.oneLiner).toBeTruthy();
    expect(result.bullets.length).toBeGreaterThan(0);
  });

  it("returns sections with headings and bullets", () => {
    const text =
      "The marketing team presented the Q4 campaign results. " +
      "Revenue increased by 15% compared to last quarter. " +
      "Customer acquisition cost decreased significantly. " +
      "Engineering discussed the API redesign project. " +
      "The new REST endpoints will replace the legacy SOAP services. " +
      "Migration timeline is set for next month.";

    const result = extractiveSummarize(text);

    for (const section of result.sections) {
      expect(section.heading).toBeTruthy();
      expect(section.bullets.length).toBeGreaterThan(0);
    }
  });

  it("extracts action items into nextSteps", () => {
    const text =
      "We discussed the project timeline. " +
      "John needs to prepare the deployment plan by Friday. " +
      "Sarah should review the security audit findings. " +
      "The team will schedule a follow-up meeting next week.";

    const result = extractiveSummarize(text);
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });

  it("extracts owner from action items when possible", () => {
    const text =
      "The meeting covered several important topics. " +
      "Alice will send the updated requirements document. " +
      "Bob needs to fix the authentication bug before release.";

    const result = extractiveSummarize(text);
    const withOwner = result.nextSteps.filter((s) => s.owner !== null);
    expect(withOwner.length).toBeGreaterThan(0);
  });

  it("produces bullets as a flat list for backwards compatibility", () => {
    const text =
      "First important point about the architecture. " +
      "Second important point about testing strategy. " +
      "Third important point about deployment process. " +
      "Fourth point about monitoring and observability.";

    const result = extractiveSummarize(text);
    expect(result.bullets.length).toBeGreaterThan(0);
    expect(result.bullets.length).toBeLessThanOrEqual(6);
    for (const b of result.bullets) {
      expect(typeof b).toBe("string");
      expect(b.length).toBeGreaterThan(0);
    }
  });

  it("handles single-sentence text", () => {
    const result = extractiveSummarize(
      "The quarterly review meeting was held today.",
    );
    expect(result.oneLiner).toBeTruthy();
    expect(result.sections.length).toBeGreaterThanOrEqual(0);
  });

  it("does not include trailing punctuation in bullets", () => {
    const text =
      "First sentence about the project. Second sentence about testing.";
    const result = extractiveSummarize(text);
    for (const bullet of result.bullets) {
      expect(bullet).not.toMatch(/[.!?]$/);
    }
  });
});
