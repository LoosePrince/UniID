/**
 * RealtimeService — 基于 SSE 的实时通道（单实例）。
 *
 * 频道命名同时兼容完整形态和 SDK 简写：
 *   records:{appId}:{dataType}                  全 dataType
 *   records:{appId}:{dataType}:{recordId}       单条
 *   records:{dataType}                          SDK 简写
 *   records:{dataType}:{recordId}               SDK 简写
 *   broadcast:{appId}:{channel}                 自定义广播
 *   broadcast:{channel} / {channel}             SDK 简写
 *   presence:{appId}:{channel}                  在场名单
 */

import { randomUUID } from "node:crypto";
import { bus } from "@/shared/bus";
import type { DomainEventEnvelope } from "@/shared/bus";
import { prisma } from "@/shared/prisma";
import { PolicyEngine, type AuthContext } from "@/shared/policy";

export type RealtimeEventType = "insert" | "update" | "delete" | "broadcast" | "presence";

export interface RealtimeDispatch {
  id: string;
  event: string;
  type: RealtimeEventType;
  channel: string;
  payload: unknown;
  at: number;
}

interface Subscriber {
  id: string;
  appId: string;
  userId: string | null;
  role?: string | null;
  systemAdmin?: boolean;
  appAdmin?: boolean;
  authType?: "full" | "restricted";
  origin?: AuthContext["origin"];
  channels: Set<string>;
  send: (event: string, data: unknown) => void;
  close: () => void;
}

const subscribers = new Set<Subscriber>();
const now = () => Math.floor(Date.now() / 1000);

export function normalizeRealtimeChannel(appId: string, channel: string): string | null {
  const value = channel.trim();
  if (!value) return null;

  const parts = value.split(":").filter(Boolean);
  const kind = parts[0];

  if (kind === "records") {
    if (parts[1] === appId && parts.length >= 3) return parts.join(":");
    if (parts.length === 2) return `records:${appId}:${parts[1]}`;
    if (parts.length === 3) return `records:${appId}:${parts[1]}:${parts[2]}`;
    return value;
  }

  if (kind === "broadcast") {
    if (parts[1] === appId && parts.length >= 3) return parts.join(":");
    const rest = parts.slice(1).join(":");
    return rest ? `broadcast:${appId}:${rest}` : null;
  }

  if (kind === "presence") {
    if (parts[1] === appId && parts.length >= 3) return parts.join(":");
    const rest = parts.slice(1).join(":");
    return rest ? `presence:${appId}:${rest}` : null;
  }

  return `broadcast:${appId}:${value}`;
}

export function normalizeRealtimeChannels(appId: string, channels: string[]): string[] {
  return Array.from(
    new Set(channels.map((channel) => normalizeRealtimeChannel(appId, channel)).filter(Boolean))
  ) as string[];
}

function recordChannels(env: DomainEventEnvelope): string[] {
  const p = env.payload as { appId?: string; dataType?: string; recordId?: string };
  if (!p.appId || !p.dataType) return [];
  return [
    `records:${p.appId}:${p.dataType}`,
    ...(p.recordId ? [`records:${p.appId}:${p.dataType}:${p.recordId}`] : [])
  ];
}

function eventType(name: string): RealtimeEventType {
  if (name === "record.created") return "insert";
  if (name === "record.updated") return "update";
  if (name === "record.deleted") return "delete";
  return "broadcast";
}

function dispatch(channel: string, event: string, payload: unknown, id: string = randomUUID()): RealtimeDispatch {
  return { id, event, type: eventType(event), channel, payload, at: now() };
}

async function loadPolicyDocuments(appId: string, dataType: string, recordId?: string) {
  const where = [
    { scope: "app" as const, target: null as string | null },
    { scope: "dataType" as const, target: dataType },
    ...(recordId ? [{ scope: "record" as const, target: recordId }] : [])
  ];
  const docs = await prisma.policyDocument.findMany({
    where: { appId, OR: where as Array<{ scope: string; target: string | null }> }
  });
  const orderKey = { app: 0, dataType: 1, record: 2 };
  return docs
    .sort(
      (a, b) =>
        (orderKey as Record<string, number>)[a.scope]! -
        (orderKey as Record<string, number>)[b.scope]!
    )
    .map((d) => d.document);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function subscriberActor(sub: Subscriber, ownerId: string | null): AuthContext {
  return {
    userId: sub.userId,
    role: sub.role ?? null,
    systemAdmin: sub.systemAdmin ?? false,
    appAdmin: sub.appAdmin ?? false,
    appId: sub.appId,
    authType: sub.authType ?? "restricted",
    ownerId,
    origin: sub.origin ?? "sdk"
  };
}

async function filterRecordPayload(env: DomainEventEnvelope, sub: Subscriber) {
  const payload = env.payload as {
    appId?: string;
    dataType?: string;
    recordId?: string;
    ownerId?: string | null;
    data?: unknown;
    before?: unknown;
    after?: unknown;
  };
  if (!payload.appId || !payload.dataType) return env.payload;
  const docs = await loadPolicyDocuments(payload.appId, payload.dataType, payload.recordId);
  const actor = subscriberActor(sub, payload.ownerId ?? null);

  if (env.name === "record.created" && payload.data !== undefined) {
    const data = asObject(payload.data);
    const whole = PolicyEngine.evaluate({ documents: docs, action: "read", currentValue: data }, actor);
    const visible = whole.allow ? data : PolicyEngine.filterReadable(data, docs, actor);
    if (Object.keys(visible).length === 0) return null;
    return { ...payload, data: visible };
  }

  if (env.name === "record.updated" && payload.after !== undefined) {
    const after = asObject(payload.after);
    const before = asObject(payload.before);
    const whole = PolicyEngine.evaluate({ documents: docs, action: "read", currentValue: after }, actor);
    const visibleAfter = whole.allow ? after : PolicyEngine.filterReadable(after, docs, actor);
    if (Object.keys(visibleAfter).length === 0) return null;
    const visibleBefore = whole.allow ? before : PolicyEngine.filterReadable(before, docs, actor);
    return { ...payload, before: visibleBefore, after: visibleAfter };
  }

  return payload;
}

bus.on("record.created", (env) => fanout(env, recordChannels(env)));
bus.on("record.updated", (env) => fanout(env, recordChannels(env)));
bus.on("record.deleted", (env) => fanout(env, recordChannels(env)));

function fanout(env: DomainEventEnvelope, channels: string[]) {
  if (channels.length === 0) return;
  const set = new Set(channels);
  for (const sub of subscribers) {
    if (sub.appId !== (env.payload as { appId?: string }).appId) continue;
    for (const ch of sub.channels) {
      if (set.has(ch)) {
        filterRecordPayload(env, sub)
          .then((payload) => {
            if (payload != null) sub.send("message", dispatch(ch, env.name, payload, env.id));
          })
          .catch(() => {});
        break;
      }
    }
  }
}

export const RealtimeService = {
  addSubscriber(sub: Subscriber) {
    subscribers.add(sub);
  },
  removeSubscriber(sub: Subscriber) {
    subscribers.delete(sub);
  },
  /** 手动 broadcast（被 SDK、Functions 沙箱或 console 调用） */
  broadcast(appId: string, channel: string, eventName: string, payload: unknown) {
    const fullChannel = normalizeRealtimeChannel(appId, channel);
    if (!fullChannel) return { channel: null, delivered: 0 };

    let delivered = 0;
    const type: RealtimeEventType = fullChannel.startsWith(`presence:${appId}:`)
      ? "presence"
      : "broadcast";
    const message: RealtimeDispatch = {
      id: randomUUID(),
      event: eventName,
      type,
      channel: fullChannel,
      payload,
      at: now()
    };

    for (const sub of subscribers) {
      if (sub.appId !== appId) continue;
      if (sub.channels.has(fullChannel)) {
        sub.send("message", message);
        delivered += 1;
      }
    }
    return { channel: fullChannel, delivered };
  },
  stats() {
    return { connections: subscribers.size };
  }
};

export type { Subscriber };
