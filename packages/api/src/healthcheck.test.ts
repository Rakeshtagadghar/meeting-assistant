import { describe, it, expect } from "vitest";
import { healthcheck } from "./healthcheck";

describe("healthcheck", () => {
  it("returns ok status", () => {
    const result = healthcheck();
    expect(result.status).toBe("ok");
  });

  it("returns a valid ISO timestamp", () => {
    const result = healthcheck();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });
});
