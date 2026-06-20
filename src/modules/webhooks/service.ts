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
const RETRY_WORKER_INTERVAL_MS = 30_000;
const DELIVERY_LEASE_SECONDS = 60;

type RetryWorkerState = {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __uniid_webhook_retry_worker__: RetryWorkerState | undefined;
}

const retryWorkerState: RetryWorkerState =
  globalThis.__uniid_webhook_retry_worker__ ?? { timer: null, running: false };
globalThis.__uniid_webhook_retry_worker__ = retryWorkerState;

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

async function claimDelivery(deliveryId: string, leaseSeconds = DELIVERY_LEASE_SECONDS): Promise<boolean> {
  const t = now();
  const result = await prisma.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { in: ["pending", "failed"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: t } }]
    },
    data: {
      status: "pending",
      nextRetryAt: t + leaseSeconds,
      updatedAt: t
    }
  });
  return result.count > 0;
}

async function attemptDelivery(deliveryId: string) {
  const claimed = await claimDelivery(deliveryId);
  if (!claimed) return;

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
        data: { status: "success", statusCode: res.status, durationMs, nextRetryAt: null, updatedAt: t }
      });
      return;
    }

    await scheduleRetry(deliveryId, delivery.attempt + 1, `status=${res.status}`, res.status, durationMs);
  } catch (err) {
    await scheduleRetry(deliveryId, delivery.attempt + 1, String(err));
  }
}

async function replayDueDeliveries(limit = 100): Promise<{ attempted: number; failed: number }> {
  if (retryWorkerState.running) return { attempted: 0, failed: 0 };
  retryWorkerState.running = true;
  try {
    const t = now();
    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        status: { in: ["pending", "failed"] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: t } }],
        webhook: { isActive: 1 }
      },
      orderBy: { updatedAt: "asc" },
      take: Math.min(Math.max(limit, 1), 500)
    });

    let failed = 0;
    for (const delivery of deliveries) {
      try {
        await attemptDelivery(delivery.id);
      } catch (err) {
        failed += 1;
        logger.error({ err, deliveryId: delivery.id }, "webhook due delivery replay failed");
      }
    }

    return { attempted: deliveries.length, failed };
  } finally {
    retryWorkerState.running = false;
  }
}

function startRetryWorker() {
  if (retryWorkerState.timer) return;
  retryWorkerState.timer = setInterval(() => {
    replayDueDeliveries().then((result) => {
      if (result.attempted > 0 || result.failed > 0) {
        logger.info(result, "webhook due deliveries replay completed");
      }
    }).catch((err) => logger.error({ err }, "webhook due delivery worker failed"));
  }, RETRY_WORKER_INTERVAL_MS);
  (retryWorkerState.timer as { unref?: () => void }).unref?.();
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
  // setTimeout 是快速路径；进程重启或错过窗口时由 retry worker 从数据库恢复。
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
    "auth.email_verified",
    "auth.password_reset",
    "authorization.granted",
    "authorization.revoked",
    "schema.activated"
  ];
  for (const e of events) {
    bus.on(e, (env) => dispatch(env));
  }
  startRetryWorker();
  replayDueDeliveries().then((result) => {
    if (result.attempted > 0 || result.failed > 0) {
      logger.info(result, "webhook due deliveries replay completed");
    }
  }).catch((err) => logger.error({ err }, "webhook due delivery replay failed"));
  booted = true;
}

export class WebhooksService {
  static ensureBoot() {
    ensureBoot();
  }

  static async replayDueDeliveries(limit = 100) {
    return replayDueDeliveries(limit);
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

  static async rotateSecret(appId: string, hookId: string) {
    const hook = await prisma.webhook.findFirst({ where: { id: hookId, appId } });
    if (!hook) throw new ApiError("HOOK_NOT_FOUND");
    const t = now();
    return prisma.webhook.update({
      where: { id: hook.id },
      data: { secret: generateSecret(), updatedAt: t }
    });
  }

  static async setActive(appId: string, hookId: string, isActive: boolean) {
    const hook = await prisma.webhook.findFirst({ where: { id: hookId, appId } });
    if (!hook) throw new ApiError("HOOK_NOT_FOUND");
    return prisma.webhook.update({
      where: { id: hook.id },
      data: { isActive: isActive ? 1 : 0, updatedAt: now() }
    });
  }

  static async update(input: {
    appId: string;
    hookId: string;
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
  }) {
    const hook = await prisma.webhook.findFirst({ where: { id: input.hookId, appId: input.appId } });
    if (!hook) throw new ApiError("HOOK_NOT_FOUND");
    if (input.url && !/^https?:\/\//.test(input.url)) throw new ApiError("HOOK_INVALID_URL");
    return prisma.webhook.update({
      where: { id: hook.id },
      data: {
        name: input.name,
        url: input.url,
        events: input.events ? JSON.stringify(input.events) : undefined,
        isActive: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
        updatedAt: now()
      }
    });
  }

  static async deleteOne(appId: string, hookId: string) {
    const hook = await prisma.webhook.findFirst({ where: { id: hookId, appId } });
    if (!hook) throw new ApiError("HOOK_NOT_FOUND");
    await prisma.webhook.delete({ where: { id: hook.id } });
  }

  static async listDeliveries(appId: string, hookId: string, limit = 50) {
    const hook = await prisma.webhook.findFirst({ where: { id: hookId, appId } });
    if (!hook) throw new ApiError("HOOK_NOT_FOUND");
    return prisma.webhookDelivery.findMany({
      where: { webhookId: hook.id },
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

  static async retryDeliveryForHook(appId: string, hookId: string, deliveryId: string) {
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, webhookId: hookId, webhook: { appId } }
    });
    if (!delivery) throw new ApiError("HOOK_NOT_FOUND");
    await this.retryDelivery(delivery.id);
  }

  /** 发起 test ping。 */
  static async ping(appId: string, hookId: string) {
    const hook = await prisma.webhook.findFirst({ where: { id: hookId, appId } });
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
