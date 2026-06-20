import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const API_KEY_PREFIX = "uniid_sk_";
const KEY_BYTES = 32;
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 10;

export function generateApiKey() {
  const secret = randomBytes(KEY_BYTES).toString("base64url");
  const plain = `${API_KEY_PREFIX}${secret}`;
  return {
    plain,
    hash: hashApiKey(plain),
    prefix: plain.slice(0, DISPLAY_PREFIX_LENGTH)
  };
}

export function hashApiKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isApiKey(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(API_KEY_PREFIX);
}

export function safeCompareHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
