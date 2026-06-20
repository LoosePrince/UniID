import { createHash, randomBytes } from "node:crypto";

export interface GeneratedDatabaseKey {
  plain: string;
  hash: string;
  prefix: string;
}

export function generateDatabaseKey(): GeneratedDatabaseKey {
  const plain = `lsq_${randomBytes(24).toString("base64url")}`;
  return {
    plain,
    hash: hashDatabaseKey(plain),
    prefix: plain.slice(0, 12)
  };
}

export function hashDatabaseKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function isDatabaseKey(secret: string): boolean {
  return /^lsq_[A-Za-z0-9_-]{32}$/.test(secret);
}

