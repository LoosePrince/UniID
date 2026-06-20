import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/prisma";
import type { DomainEventEnvelope, DomainEventMap, DomainEventName } from "./events";

const nowSeconds = () => Math.floor(Date.now() / 1000);
const CLAIM_LEASE_SECONDS = 60;
const MAX_ATTEMPTS = 8;
const BACKOFF_SECONDS = [60, 300, 900, 3600, 14_400, 43_200, 86_400, 86_400];

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function appIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>).appId;
  return typeof value === "string" ? value : null;
}

function resourceOf(name: DomainEventName, payload: unknown): { resourceType: string | null; resourceId: string | null } {
  if (!payload || typeof payload !== "object") return { resourceType: null, resourceId: null };
  const source = payload as Record<string, unknown>;

  if (name.startsWith("record.")) {
    return { resourceType: "record", resourceId: typeof source.recordId === "string" ? source.recordId : null };
  }
  if (name.startsWith("file.")) {
    return { resourceType: "file", resourceId: typeof source.fileId === "string" ? source.fileId : null };
  }
  if (name.startsWith("auth.")) {
    return { resourceType: "session", resourceId: typeof source.sessionId === "string" ? source.sessionId : null };
  }
  if (name.startsWith("authorization.")) {
    return { resourceType: "authorization", resourceId: null };
  }
  if (name.startsWith("schema.")) {
    return { resourceType: "schema", resourceId: typeof source.dataType === "string" ? source.dataType : null };
  }

  return { resourceType: null, resourceId: null };
}

export class EventOutboxService {
  static async create<E extends DomainEventName>(
    name: E,
    payload: DomainEventMap[E],
    options?: { causedByEventId?: string | null }
  ): Promise<DomainEventEnvelope<E>> {
    const id = randomUUID();
    const envelope: DomainEventEnvelope<E> = {
      id,
      name,
      payload,
      at: Date.now()
    };
    const t = nowSeconds();
    const resource = resourceOf(name, payload);

    await prisma.eventOutbox.create({
      data: {
        id,
        appId: appIdOf(payload),
        eventType: name,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        payload: serialize(envelope),
        status: "pending",
        attempts: 0,
        causedByEventId: options?.causedByEventId ?? null,
        createdAt: t,
        updatedAt: t
      }
    });

    return envelope;
  }

  static async markDispatched(eventId: string): Promise<void> {
    const t = nowSeconds();
    await prisma.eventOutbox.update({
      where: { id: eventId },
      data: {
        status: "dispatched",
        dispatchedAt: t,
        nextAttemptAt: null,
        updatedAt: t,
        errorMessage: null
      }
    });
  }

  static async markFailed(eventId: string, error: unknown): Promise<void> {
    const t = nowSeconds();
    const existing = await prisma.eventOutbox.findUnique({
      where: { id: eventId },
      select: { attempts: true }
    });
    const attempts = (existing?.attempts ?? 0) + 1;
    const dlq = attempts >= MAX_ATTEMPTS;
    const wait = BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)]!;

    await prisma.eventOutbox.update({
      where: { id: eventId },
      data: {
        status: dlq ? "dlq" : "failed",
        attempts,
        errorMessage: String(error).slice(0, 2048),
        nextAttemptAt: dlq ? null : t + wait,
        updatedAt: t
      }
    });
  }

  static async claimDue(eventId: string, leaseSeconds = CLAIM_LEASE_SECONDS): Promise<boolean> {
    const t = nowSeconds();
    const result = await prisma.eventOutbox.updateMany({
      where: {
        id: eventId,
        status: { in: ["pending", "failed"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: t } }]
      },
      data: {
        nextAttemptAt: t + leaseSeconds,
        updatedAt: t
      }
    });
    return result.count > 0;
  }

  static parseEnvelope(value: string): DomainEventEnvelope | null {
    try {
      const parsed = JSON.parse(value) as Partial<DomainEventEnvelope> | null;
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
      if (!Object.prototype.hasOwnProperty.call(parsed, "payload")) return null;
      if (typeof parsed.at !== "number") return null;
      return parsed as DomainEventEnvelope;
    } catch {
      return null;
    }
  }

  static async listPending(limit = 100) {
    const t = nowSeconds();
    return prisma.eventOutbox.findMany({
      where: {
        status: { in: ["pending", "failed"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: t } }]
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(Math.max(limit, 1), 500)
    });
  }
}
