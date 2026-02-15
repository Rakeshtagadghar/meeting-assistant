import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { UUID } from "@ainotes/core";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  u: string;
  n: string;
  t: number;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getStateSecret(): string {
  const secret =
    process.env["INTEGRATIONS_OAUTH_STATE_SECRET"] ??
    process.env["NEXTAUTH_SECRET"];

  if (!secret) {
    throw new Error(
      "Missing INTEGRATIONS_OAUTH_STATE_SECRET or NEXTAUTH_SECRET",
    );
  }

  return secret;
}

export function createOAuthState(userId: UUID): string {
  const payload: OAuthStatePayload = {
    u: userId,
    n: randomBytes(16).toString("hex"),
    t: Date.now(),
  };

  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getStateSecret())
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

export function verifyOAuthState(state: string): { userId: UUID } {
  const [payloadEncoded, signature] = state.split(".");
  if (!payloadEncoded || !signature) {
    throw new Error("Invalid OAuth state format");
  }

  const expected = createHmac("sha256", getStateSecret())
    .update(payloadEncoded)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("OAuth state signature mismatch");
  }

  const payload = JSON.parse(
    fromBase64Url(payloadEncoded),
  ) as OAuthStatePayload;
  if (!payload.u || !payload.t) {
    throw new Error("OAuth state payload missing fields");
  }

  if (Date.now() - payload.t > OAUTH_STATE_TTL_MS) {
    throw new Error("OAuth state expired");
  }

  return { userId: payload.u as UUID };
}
