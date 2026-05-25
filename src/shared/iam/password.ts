import argon2 from "argon2";
import { config } from "../config";

export async function hashPassword(plain: string): Promise<string> {
  const c = config();
  return argon2.hash(plain, {
    type: argon2.argon2id,
    timeCost: c.ARGON2_TIME_COST,
    memoryCost: c.ARGON2_MEMORY_KB,
    parallelism: c.ARGON2_PARALLELISM
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
