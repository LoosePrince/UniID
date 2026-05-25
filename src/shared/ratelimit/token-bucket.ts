/**
 * 简单的 token-bucket 限流器，落到 Prisma `RateLimitBucket` 表上做持久化。
 *
 * 使用模式：
 *   await rateLimit({ key: `app:${appId}:ip:${ip}`, capacity: 60, refillPerSecond: 60 });
 *
 * 失败时抛出 ApiError("RATE_LIMITED")。
 */
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";

const nowMs = () => Date.now();

export interface RateLimitOptions {
  /** 桶 key，如 "app:{appId}:ip:{ip}" 或 "user:{userId}:login"。 */
  key: string;
  /** 桶容量（最大瞬时突发）。 */
  capacity: number;
  /** 每秒补充速率（个 / 秒）。 */
  refillPerSecond: number;
  /** 单次消耗，默认 1。 */
  cost?: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const cost = opts.cost ?? 1;
  const t = nowMs();

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key: opts.key } });

  let tokens = bucket?.tokens ?? opts.capacity;
  let refilledAt = bucket?.refilledAt ?? t;

  const elapsedSec = Math.max(0, (t - refilledAt) / 1000);
  tokens = Math.min(opts.capacity, tokens + Math.floor(elapsedSec * opts.refillPerSecond));
  refilledAt = t;

  if (tokens < cost) {
    await prisma.rateLimitBucket.upsert({
      where: { key: opts.key },
      create: { key: opts.key, tokens, refilledAt },
      update: { tokens, refilledAt }
    });
    return {
      ok: false,
      remaining: tokens,
      resetMs: Math.ceil(((cost - tokens) / opts.refillPerSecond) * 1000)
    };
  }

  tokens -= cost;
  await prisma.rateLimitBucket.upsert({
    where: { key: opts.key },
    create: { key: opts.key, tokens, refilledAt },
    update: { tokens, refilledAt }
  });
  return { ok: true, remaining: tokens, resetMs: 0 };
}

export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  const r = await rateLimit(opts);
  if (!r.ok) throw new ApiError("RATE_LIMITED");
}
