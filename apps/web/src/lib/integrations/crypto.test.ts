import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./crypto";

const originalKey = process.env["INTEGRATIONS_ENCRYPTION_KEY"];

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env["INTEGRATIONS_ENCRYPTION_KEY"];
  } else {
    process.env["INTEGRATIONS_ENCRYPTION_KEY"] = originalKey;
  }
});

describe("integrations crypto", () => {
  it("encrypts and decrypts a secret", () => {
    process.env["INTEGRATIONS_ENCRYPTION_KEY"] = "test-encryption-key";

    const encrypted = encryptSecret("super-secret-token");

    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toBe("super-secret-token");
    expect(decryptSecret(encrypted)).toBe("super-secret-token");
  });

  it("leaves plaintext as-is for backward compatibility", () => {
    expect(decryptSecret("legacy-token")).toBe("legacy-token");
  });

  it("throws when encryption key is missing", () => {
    delete process.env["INTEGRATIONS_ENCRYPTION_KEY"];

    expect(() => encryptSecret("token")).toThrow(
      "Missing INTEGRATIONS_ENCRYPTION_KEY",
    );
  });
});
