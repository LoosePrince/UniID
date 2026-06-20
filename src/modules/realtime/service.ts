/**
 * RealtimeService — 基于 SSE 的实时通道（单实例）。
 *
 * 频道命名同时兼容完整形态和 SDK 简写：
 *   records:{appId}:{dataType}                  全 dataType
 *   records:{appId}:{dataType}:{recordId}       单条
 *   records:{dataType}                          SDK 简写
 *   records:{dataType}:{recordId}               SDK 简写
 *   query:{appId}:{dataType}:{dslBase64Url?}    查询快照
 *   query:{dataType}:{dslBase64Url?}            SDK 简写
 *   broadcast:{appId}:{channel}                 自定义广播
 *   broadcast:{channel} / {channel}             SDK 简写
 *   presence:{appId}:{channel}                  在场名单
 */

import { createHash, randomUUID } from "node:crypto";
import { bus } from "@/shared/bus";
import type { DomainEventEnvelope } from "@/shared/bus";
import { prisma } from "@/shared/prisma";
import { PolicyEngine, type AuthContext } from "@/shared/policy";
import type { DataQuery } from "@/modules/data";

export type RealtimeEventType = "insert" | "update" | "delete" | "broadcast" | "presence" | "query";

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
  send: (event: string, data: unknown, id?: string) => void;
  close: () => void;
}

interface PresenceMember {
  connectionId: string;
  userId: string | null;
  role: string | null;
  joinedAt: number;
}

interface QuerySpec {
  dataType: string;
  dsl: DataQuery;
}

type HistoryEntry =
  | {
      kind: "dispatch";
      id: string;
      appId: string;
      channel: string;
      message: RealtimeDispatch;
      createdAtMs: number;
    }
  | {
      kind: "record";
      id: string;
      appId: string;
      channel: string;
      env: DomainEventEnvelope;
      createdAtMs: number;
    }
  | {
      kind: "query";
      id: string;
      appId: string;
      channel: string;
      event: string;
      createdAtMs: number;
    };

const subscribers = new Set<Subscriber>();
const presenceMembers = new Map<string, Map<string, PresenceMember>>();
const history: HistoryEntry[] = [];
const HISTORY_TTL_MS = 60_000;
const HISTORY_MAX = 1_000;
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

  if (kind === "query") {
    if (parts[1] === appId && parts.length >= 3) {
      return ["query", appId, parts[2], parts[3]].filter(Boolean).join(":");
    }
    if (parts.length >= 2) {
      return ["query", appId, parts[1], parts[2]].filter(Boolean).join(":");
    }
    return null;
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
    new Set(
      channels
        .map((channel) => normalizeRealtimeChannel(appId, channel))
        .filter((channel): channel is string => Boolean(channel))
    )
  );
}

function hashChannel(channel: string) {
  return createHash("sha1").update(channel).digest("base64url").slice(0, 12);
}

function channelEventId(baseId: string, channel: string) {
  return `${baseId}:${hashChannel(channel)}`;
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

function dispatch(
  channel: string,
  event: string,
  payload: unknown,
  id: string = randomUUID() as string,
  type: RealtimeEventType = eventType(event)
): RealtimeDispatch {
  return { id, event, type, channel, payload, at: now() };
}

function remember(entry: HistoryEntry) {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  while (history.length > 0 && (history[0]?.createdAtMs ?? 0) < cutoff) history.shift();
  history.push(entry);
  while (history.length > HISTORY_MAX) history.shift();
}

function rememberDispatch(appId: string, message: RealtimeDispatch) {
  remember({
    kind: "dispatch",
    id: message.id,
    appId,
    channel: message.channel,
    message,
    createdAtMs: Date.now()
  });
}

function rememberRecord(appId: string, channel: string, env: DomainEventEnvelope, id: string) {
  remember({ kind: "record", id, appId, channel, env, createdAtMs: Date.now() });
}

function rememberQuery(appId: string, channel: string, event: string, id: string) {
  remember({ kind: "query", id, appId, channel, event, createdAtMs: Date.now() });
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

function normalizeOrderBy(value: unknown): Record<string, "asc" | "desc"> | undefined {
  const out = Object.entries(asObject(value)).reduce<Record<string, "asc" | "desc">>((acc, [key, item]) => {
    if (item === "asc" || item === "desc") acc[key] = item;
    return acc;
  }, {});
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeQueryDsl(value: unknown): DataQuery {
  const raw = asObject(value);
  return {
    where: Object.keys(asObject(raw.where)).length > 0 ? asObject(raw.where) : undefined,
    select: Array.isArray(raw.select) ? raw.select.filter((item): item is string => typeof item === "string") : undefined,
    orderBy: normalizeOrderBy(raw.orderBy),
    limit: typeof raw.limit === "number" ? raw.limit : undefined,
    cursor: typeof raw.cursor === "string" ? raw.cursor : undefined
  };
}

function decodeQueryDsl(encoded?: string): DataQuery {
  if (!encoded) return {};
  try {
    return normalizeQueryDsl(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown);
  } catch {
    return {};
  }
}

function querySpecFromChannel(channel: string): QuerySpec | null {
  const parts = channel.split(":").filter(Boolean);
  if (parts[0] !== "query" || parts.length < 3) return null;
  const dataType = parts[2];
  if (!dataType) return null;
  return { dataType, dsl: decodeQueryDsl(parts[3]) };
}

function sendDispatch(sub: Subscriber, message: RealtimeDispatch) {
  sub.send("message", message, message.id);
}

function emitDispatch(
  appId: string,
  channel: string,
  event: string,
  type: RealtimeEventType,
  payload: unknown,
  excludeSubscriberId?: string
) {
  const message = dispatch(channel, event, payload, randomUUID(), type);
  rememberDispatch(appId, message);
  let delivered = 0;
  for (const sub of subscribers) {
    if (sub.id === excludeSubscriberId || sub.appId !== appId) continue;
    if (!sub.channels.has(channel)) continue;
    sendDispatch(sub, message);
    delivered += 1;
  }
  return { message, delivered };
}

function presencePayload(channel: string) {
  return {
    members: Array.from(presenceMembers.get(channel)?.values() ?? []),
    count: presenceMembers.get(channel)?.size ?? 0
  };
}

function addPresence(sub: Subscriber) {
  for (const channel of sub.channels) {
    if (!channel.startsWith(`presence:${sub.appId}:`)) continue;
    const members = presenceMembers.get(channel) ?? new Map<string, PresenceMember>();
    const member: PresenceMember = {
      connectionId: sub.id,
      userId: sub.userId,
      role: sub.role ?? null,
      joinedAt: now()
    };
    members.set(sub.id, member);
    presenceMembers.set(channel, members);

    sendDispatch(
      sub,
      dispatch(channel, "presence.snapshot", presencePayload(channel), randomUUID(), "presence")
    );
    emitDispatch(sub.appId, channel, "presence.join", "presence", { member, ...presencePayload(channel) }, sub.id);
  }
}

function removePresence(sub: Subscriber) {
  for (const channel of sub.channels) {
    if (!channel.startsWith(`presence:${sub.appId}:`)) continue;
    const members = presenceMembers.get(channel);
    const member = members?.get(sub.id);
    if (!members || !member) continue;
    members.delete(sub.id);
    if (members.size === 0) presenceMembers.delete(channel);
    emitDispatch(sub.appId, channel, "presence.leave", "presence", { member, ...presencePayload(channel) }, sub.id);
  }
}

async function sendQuerySnapshot(
  sub: Subscriber,
  channel: string,
  id: string = randomUUID() as string,
  event = "query.snapshot"
) {
  const spec = querySpecFromChannel(channel);
  if (!spec) return false;
  const { DataService } = await import("@/modules/data");
  const result = await DataService.query({
    appId: sub.appId,
    dataType: spec.dataType,
    dsl: spec.dsl,
    actor: subscriberActor(sub, null)
  });
  sendDispatch(
    sub,
    dispatch(
      channel,
      event,
      { dataType: spec.dataType, query: spec.dsl, records: result.records, nextCursor: result.nextCursor ?? null },
      id,
      "query"
    )
  );
  return true;
}

function sendInitialQuerySnapshots(sub: Subscriber) {
  for (const channel of sub.channels) {
    if (!channel.startsWith(`query:${sub.appId}:`)) continue;
    void sendQuerySnapshot(sub, channel).catch(() => {});
  }
}

bus.on("record.created", (env) => {
  fanout(env, recordChannels(env));
  fanoutQueries(env);
});
bus.on("record.updated", (env) => {
  fanout(env, recordChannels(env));
  fanoutQueries(env);
});
bus.on("record.deleted", (env) => {
  fanout(env, recordChannels(env));
  fanoutQueries(env);
});

function fanout(env: DomainEventEnvelope, channels: string[]) {
  const appId = (env.payload as { appId?: string }).appId;
  if (!appId || channels.length === 0) return;
  const set = new Set(channels);
  const ids = new Map(channels.map((channel) => [channel, channelEventId(env.id, channel)]));

  for (const channel of channels) {
    rememberRecord(appId, channel, env, ids.get(channel)!);
  }

  for (const sub of subscribers) {
    if (sub.appId !== appId) continue;
    for (const ch of sub.channels) {
      if (set.has(ch)) {
        filterRecordPayload(env, sub)
          .then((payload) => {
            if (payload != null) {
              sendDispatch(sub, dispatch(ch, env.name, payload, ids.get(ch), eventType(env.name)));
            }
          })
          .catch(() => {});
        break;
      }
    }
  }
}

function fanoutQueries(env: DomainEventEnvelope) {
  const payload = env.payload as { appId?: string; dataType?: string };
  if (!payload.appId || !payload.dataType) return;
  const emitted = new Set<string>();

  for (const sub of subscribers) {
    if (sub.appId !== payload.appId) continue;
    for (const channel of sub.channels) {
      const spec = querySpecFromChannel(channel);
      if (!spec || spec.dataType !== payload.dataType) continue;
      const id = channelEventId(env.id, channel);
      if (!emitted.has(channel)) {
        rememberQuery(payload.appId, channel, "query.updated", id);
        emitted.add(channel);
      }
      void sendQuerySnapshot(sub, channel, id, "query.updated").catch(() => {});
    }
  }
}

async function replayRecord(entry: Extract<HistoryEntry, { kind: "record" }>, sub: Subscriber) {
  const payload = await filterRecordPayload(entry.env, sub);
  if (payload == null) return false;
  sendDispatch(sub, dispatch(entry.channel, entry.env.name, payload, entry.id, eventType(entry.env.name)));
  return true;
}

export const RealtimeService = {
  addSubscriber(sub: Subscriber) {
    subscribers.add(sub);
    addPresence(sub);
    sendInitialQuerySnapshots(sub);
  },
  removeSubscriber(sub: Subscriber) {
    subscribers.delete(sub);
    removePresence(sub);
  },
  async replay(sub: Subscriber, lastEventId?: string | null) {
    if (!lastEventId) return { replayed: 0, missed: false };
    const index = history.findIndex((entry) => entry.id === lastEventId);
    if (index < 0) return { replayed: 0, missed: true };

    let replayed = 0;
    for (const entry of history.slice(index + 1)) {
      if (entry.appId !== sub.appId || !sub.channels.has(entry.channel)) continue;
      if (entry.kind === "dispatch") {
        sendDispatch(sub, entry.message);
        replayed += 1;
      } else if (entry.kind === "record") {
        if (await replayRecord(entry, sub)) replayed += 1;
      } else if (await sendQuerySnapshot(sub, entry.channel, entry.id, entry.event)) {
        replayed += 1;
      }
    }
    return { replayed, missed: false };
  },
  /** 手动 broadcast（被 SDK、Functions 沙箱或 console 调用） */
  broadcast(appId: string, channel: string, eventName: string, payload: unknown) {
    const fullChannel = normalizeRealtimeChannel(appId, channel);
    if (!fullChannel) return { channel: null, delivered: 0 };

    const type: RealtimeEventType = fullChannel.startsWith(`presence:${appId}:`)
      ? "presence"
      : "broadcast";
    const { delivered } = emitDispatch(appId, fullChannel, eventName, type, payload);
    return { channel: fullChannel, delivered };
  },
  stats() {
    return {
      connections: subscribers.size,
      presenceChannels: presenceMembers.size,
      history: history.length
    };
  }
};

export type { Subscriber };
