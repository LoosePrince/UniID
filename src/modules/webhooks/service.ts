/**
 * WebhooksService — 注册 webhook、监听事件并投递（带重试 / HMAC 签名 / 死信）。
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { bus, type DomainEventEnvelope, type DomainEventName } from "@/shared/bus";
import { logger } from "@/shared/logger";

const now = () => Math.floor(Date.now() / 1000);
const MAX_ATTEMPTS = 6;
const BACKOFF_SECONDS = [10, 60, 300, 900, 3600, 14400];

function shouldDeliver(events: string[], name: DomainEventName): boolean {
  if (events.length === 0) return false;
  if (events.includes("*")) return true;
  if (events.includes(name)) return true;
  // 支持 wildcard：record.* 匹配 record.created/updated/deleted
  return events.some((e) => e.endsWith(".*") && name.startsWith(e.slice(0, -1)));
}

function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

function sign(secret: string, body: string, timestamp: number): string {
  const h = createHmac("sha256", secret);
  h.update(`${timestamp}.${body}`);
  return h.digest("hex");
}

async function attemptDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true }
  });
  if (!delivery || delivery.status === "success") return;
  if (!delivery.webhook.isActive) return;

  const t = now();
  const body = delivery.payload;
  const sig = sign(delivery.webhook.secret, body, t);

  try {
    const start = Date.now();
    const res = await fetch(delivery.webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-UniID-Event": delivery.eventType,
        "X-UniID-Delivery-Id": delivery.id,
        "X-UniID-Timestamp": String(t),
        "X-UniID-Signature": `sha256=${sig}`
      },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    const durationMs = Date.now() - start;

    if (res.status >= 200 && res.status < 300) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: "success", statusCode: res.status, durationMs, updatedAt: t }
      });
      return;
    }

    await scheduleRetry(deliveryId, delivery.attempt + 1, `status=${res.status}`, res.status, durationMs);
  } catch (err) {
    await scheduleRetry(deliveryId, delivery.attempt + 1, String(err));
  }
}

async function scheduleRetry(deliveryId: string, nextAttempt: number, error: string, statusCode?: number, durationMs?: number) {
  const t = now();
  if (nextAttempt >= MAX_ATTEMPTS) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "dlq",
        attempt: nextAttempt,
        errorMessage: error,
        statusCode: statusCode ?? null,
        durationMs: durationMs ?? null,
        nextRetryAt: null,
        updatedAt: t
      }
    });
    return;
  }
  const wait = BACKOFF_SECONDS[Math.min(nextAttempt - 1, BACKOFF_SECONDS.length - 1)]!;
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "failed",
      attempt: nextAttempt,
      errorMessage: error,
      statusCode: statusCode ?? null,
      durationMs: durationMs ?? null,
      nextRetryAt: t + wait,
      updatedAt: t
    }
  });
  // 简单的 setTimeout 调度（单实例 OK）
  setTimeout(() => attemptDelivery(deliveryId).catch(() => {}), wait * 1000);
}

async function dispatch(env: DomainEventEnvelope) {
  const p = env.payload as { appId?: string };
  if (!p.appId) return;
  const hooks = await prisma.webhook.findMany({
    where: { appId: p.appId, isActive: 1 }
  });
  for (const h of hooks) {
    let events: string[] = [];
    try { events = JSON.parse(h.events) as string[]; } catch {}
    if (!shouldDeliver(events, env.name)) continue;

    const payloadObj = { id: env.id, type: env.name, payload: env.payload, at: env.at };
    const body = JSON.stringify(payloadObj);
    const t = now();
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: h.id,
        eventId: env.id,
        eventType: env.name,
        payload: body,
        status: "pending",
        createdAt: t,
        updatedAt: t
      }
    });
    // 立即异步投递
    attemptDelivery(delivery.id).catch((err) => logger.error({ err }, "webhook delivery failed"));
  }
}

// 注册全部事件监听
let booted = false;
function ensureBoot() {
  if (booted) return;
  const events: DomainEventName[] = [
    "record.created",
    "record.updated",
    "record.deleted",
    "file.uploaded",
    "file.deleted",
    "auth.login",
    "auth.logout",
    "authorization.granted",
    "authorization.revoked",
    "schema.activated"
  ];
  for (const e of events) {
    bus.on(e, (env) => dispatch(env));
  }
  booted = true;
}

export class WebhooksService {
  static ensureBoot() {
    ensureBoot();
  }

  static async listForApp(appId: string) {
    return prisma.webhook.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveries: true } } }
    });
  }

  static async create(input: {
    appId: string;
    name: string;
    url: string;
    events: string[];
    filter?: unknown;
    createdById?: string;
  }) {
    if (!/^https?:\/\//.test(input.url)) throw new ApiError("HOOK_INVALID_URL");
    const t = now();
    return prisma.webhook.create({
      data: {
        appId: input.appId,
        name: input.name,
        url: input.url,
        secret: generateSecret(),
        events: JSON.stringify(input.events),
        filter: input.filter ? JSON.stringify(input.filter) : null,
        createdAt: t,
        updatedAt: t,
        createdById: input.createdById
      }
    });
  }

  static async rotateSecret(hookId: string) {
    const t = now();
    return prisma.webhook.update({
      where: { id: hookId },
      data: { secret: generateSecret(), updatedAt: t }
    });
  }

  static async setActive(hookId: string, isActive: boolean) {
    return prisma.webhook.update({
      where: { id: hookId },
      data: { isActive: isActive ? 1 : 0, updatedAt: now() }
    });
  }

  static async deleteOne(hookId: string) {
    await prisma.webhook.delete({ where: { id: hookId } });
  }

  static async listDeliveries(hookId: string, limit = 50) {
    return prisma.webhookDelivery.findMany({
      where: { webhookId: hookId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  /** 控制台手动重试。 */
  static async retryDelivery(deliveryId: string) {
    const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new ApiError("HOOK_NOT_FOUND");
    const t = now();
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "pending", attempt: 0, nextRetryAt: null, updatedAt: t }
    });
    attemptDelivery(deliveryId).catch(() => {});
  }

  /** 发起 test ping。 */
  static async ping(hookId: string) {
    const hook = await prisma.webhook.findUnique({ where: { id: hookId } });
    if (!hook) throw new ApiError("HOOK_NOT_FOUND");
    const t = now();
    const payload = { id: randomUUID(), type: "uniid.ping", payload: { at: t }, at: t };
    const body = JSON.stringify(payload);
    const sig = sign(hook.secret, body, t);
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-UniID-Event": "uniid.ping",
        "X-UniID-Timestamp": String(t),
        "X-UniID-Signature": `sha256=${sig}`
      },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    return { status: res.status, ok: res.ok };
  }
}
