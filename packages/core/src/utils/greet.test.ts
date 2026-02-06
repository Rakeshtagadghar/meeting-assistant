import { describe, it, expect } from "vitest";
import { greet } from "./greet";

describe("greet", () => {
  it("returns a greeting with the given name", () => {
    expect(greet("AINotes")).toBe("Hello, AINotes!");
  });

  it("handles empty string", () => {
    expect(greet("")).toBe("Hello, !");
  });
});
