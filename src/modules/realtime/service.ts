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
        sub.send("message", dispatch(ch, env.name, env.payload, env.id));
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
