/**
 * RealtimeService — 基于 SSE 的实时通道（单实例）。
 *
 * 频道命名：
 *   records:{appId}:{dataType}                  全 dataType
 *   records:{appId}:{dataType}:{recordId}       单条
 *   query:{appId}:{dataType}:{queryHash}        查询订阅（重新计算后推送）— 第一版仅基础实现
 *   broadcast:{appId}:{channel}                 自定义广播
 *   presence:{appId}:{channel}                  在场名单（join/leave）
 *
 * 协议：
 *   GET /api/v1/realtime/stream?app_id=...&channels=a,b,c
 *   返回 text/event-stream
 *   每个事件 SSE：`event: <eventName>\ndata: <json>\n\n`
 *   心跳：每 25s `:ping`
 */

import { bus } from "@/shared/bus";
import type { DomainEventEnvelope } from "@/shared/bus";

interface Subscriber {
  id: string;
  appId: string;
  userId: string | null;
  channels: Set<string>;
  send: (event: string, data: unknown) => void;
  close: () => void;
}

const subscribers = new Set<Subscriber>();

function recordChannels(env: DomainEventEnvelope): string[] {
  const p = env.payload as { appId?: string; dataType?: string; recordId?: string };
  if (!p.appId || !p.dataType) return [];
  return [
    `records:${p.appId}:${p.dataType}`,
    ...(p.recordId ? [`records:${p.appId}:${p.dataType}:${p.recordId}`] : [])
  ];
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
        sub.send(env.name, { id: env.id, payload: env.payload, at: env.at });
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
  /** 手动 broadcast（被 functions 沙箱或 console 调用） */
  broadcast(appId: string, channel: string, eventName: string, payload: unknown) {
    const fullChannel = `broadcast:${appId}:${channel}`;
    for (const sub of subscribers) {
      if (sub.appId !== appId) continue;
      if (sub.channels.has(fullChannel)) {
        sub.send(eventName, payload);
      }
    }
  },
  stats() {
    return { connections: subscribers.size };
  }
};

export type { Subscriber };
