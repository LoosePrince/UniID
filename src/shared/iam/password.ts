import argon2 from "argon2";
import { getSystemConfig } from "@/shared/system-config";

export async function hashPassword(plain: string): Promise<string> {
  const c = await getSystemConfig();
  return argon2.hash(plain, {
    type: argon2.argon2id,
    timeCost: c.argon2TimeCost,
    memoryCost: c.argon2MemoryKb,
    parallelism: c.argon2Parallelism
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
