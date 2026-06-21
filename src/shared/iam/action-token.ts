import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "@/shared/config";

export type ActionTokenPurpose = "email_verify" | "password_reset" | "register_email_code";

export interface ActionTokenPayload {
  purpose: ActionTokenPurpose;
  userId: string;
  email?: string | null;
  codeHash?: string | null;
  exp: number;
  nonce: string;
}

const encoder = new TextEncoder();

function secret() {
  return config().AUTH_JWT_SECRET;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function issueActionToken(input: {
  purpose: ActionTokenPurpose;
  userId: string;
  email?: string | null;
  codeHash?: string | null;
  ttlSeconds: number;
}) {
  const payload: ActionTokenPayload = {
    purpose: input.purpose,
    userId: input.userId,
    email: input.email ?? null,
    codeHash: input.codeHash ?? null,
    exp: Math.floor(Date.now() / 1000) + input.ttlSeconds,
    nonce: randomBytes(12).toString("base64url")
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyActionToken(token: string, purpose: ActionTokenPurpose): ActionTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const expectedBytes = encoder.encode(expected);
  const actualBytes = encoder.encode(signature);
  if (expectedBytes.byteLength !== actualBytes.byteLength) return null;
  if (!timingSafeEqual(Buffer.from(expectedBytes), Buffer.from(actualBytes))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ActionTokenPayload;
    if (payload.purpose !== purpose) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}
