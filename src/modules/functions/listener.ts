import { bus, type DomainEventEnvelope, type DomainEventName } from "@/shared/bus";
import { logger } from "@/shared/logger";
import { prisma } from "@/shared/prisma";
import { FunctionsService } from "./service";

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

let booted = false;

function shouldRun(patterns: string[], name: DomainEventName): boolean {
  if (patterns.length === 0) return false;
  if (patterns.includes("*")) return true;
  if (patterns.includes(name)) return true;
  return patterns.some((pattern) => pattern.endsWith(".*") && name.startsWith(pattern.slice(0, -1)));
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cursor = value;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function matchesWhere(source: unknown, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([path, expected]) => {
    const actual = readPath(source, path);
    if (actual == null && expected == null) return true;
    return JSON.stringify(actual) === JSON.stringify(expected);
  });
}

function matchesFilter(filter: string | null, env: DomainEventEnvelope): boolean {
  if (!filter) return true;
  try {
    const parsed = JSON.parse(filter) as Record<string, unknown>;
    const payload = env.payload as Record<string, unknown>;

    if (typeof parsed.dataType === "string" && payload.dataType !== parsed.dataType) return false;
    if (typeof parsed.resourceId === "string") {
      const id = payload.recordId ?? payload.fileId ?? payload.sessionId;
      if (id !== parsed.resourceId) return false;
    }
    if (parsed.where && typeof parsed.where === "object" && !Array.isArray(parsed.where)) {
      return matchesWhere({ event: env, payload }, parsed.where as Record<string, unknown>);
    }
    return true;
  } catch {
    return false;
  }
}

async function dispatch(env: DomainEventEnvelope) {
  const payload = env.payload as { appId?: string | null };
  if (!payload.appId) return;

  const triggers = await prisma.functionEventTrigger.findMany({
    where: { appId: payload.appId, isActive: 1 },
    include: { fn: true }
  });

  for (const trigger of triggers) {
    const patterns = safeJsonArray(trigger.events);
    if (!shouldRun(patterns, env.name)) continue;
    if (!matchesFilter(trigger.filter, env)) continue;

    FunctionsService.invoke({
      appId: trigger.appId,
      fnIdOrName: trigger.fnId,
      trigger: "event",
      payload: {
        id: env.id,
        type: env.name,
        payload: env.payload,
        at: env.at,
        trigger: {
          id: trigger.id,
          name: trigger.name
        }
      }
    }).catch((err) => {
      logger.error(
        { err, eventId: env.id, eventType: env.name, triggerId: trigger.id, fnId: trigger.fnId },
        "function event trigger failed"
      );
    });
  }
}

export function ensureFunctionEventTriggersBooted() {
  if (booted) return;
  booted = true;
  for (const event of events) {
    bus.on(event, (env) => dispatch(env));
  }
}