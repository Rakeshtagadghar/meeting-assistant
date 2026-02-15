import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "enc:v1";

function getEncryptionKey(): Buffer {
  const raw = process.env["INTEGRATIONS_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error("Missing INTEGRATIONS_ENCRYPTION_KEY");
  }

  const trimmed = raw.trim();

  // Accept a 32-byte raw key or a base64-encoded value.
  try {
    const base64Decoded = Buffer.from(trimmed, "base64");
    if (base64Decoded.length === 32) {
      return base64Decoded;
    }
  } catch {
    // Ignore and fall back to hashing below.
  }

  if (Buffer.byteLength(trimmed, "utf8") === 32) {
    return Buffer.from(trimmed, "utf8");
  }

  // Deterministically derive a 32-byte key for developer ergonomics.
  return createHash("sha256").update(trimmed, "utf8").digest();
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(storedValue: string): string {
  if (!isEncryptedSecret(storedValue)) {
    // Backward-compatible fallback if older rows were saved unencrypted.
    return storedValue;
  }

  const parts = storedValue.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(parts[2]!, "base64url");
  const tag = Buffer.from(parts[3]!, "base64url");
  const encrypted = Buffer.from(parts[4]!, "base64url");

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
