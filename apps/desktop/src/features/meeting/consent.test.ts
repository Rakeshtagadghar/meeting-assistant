import { describe, it, expect } from "vitest";
import { validateConsent } from "./consent";

describe("validateConsent", () => {
  it("returns false when not confirmed", () => {
    const result = validateConsent(false, null);
    expect(result.confirmed).toBe(false);
  });

  it("returns true with default text when confirmed without text", () => {
    const result = validateConsent(true, null);
    expect(result.confirmed).toBe(true);
    expect(result.text).toBe("Always get consent before transcribing others. Confirm you have permission to record and transcribe this meeting.");
  });

  it("returns true with custom text when confirmed with text", () => {
    const result = validateConsent(true, "I agree.");
    expect(result.confirmed).toBe(true);
    expect(result.text).toBe("I agree.");
  });
});
