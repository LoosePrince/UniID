import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@uniid/sdk";

export interface UseSubscriptionResult<T> {
  events: T[];
  latest: T | null;
}

/**
 * 订阅指定频道，把事件累积到 `events`。
 * `buildChannel` 在 mount 时执行一次；deps 变更会重订阅。
 */
export function useSubscription<T = unknown>(
  buildChannel: () => RealtimeChannel,
  events: ReadonlyArray<"insert" | "update" | "delete" | "broadcast" | "presence"> = ["insert", "update", "delete"],
  deps: ReadonlyArray<unknown> = []
): UseSubscriptionResult<T> {
  const [list, setList] = useState<T[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = buildChannel();
    channelRef.current = channel;
    for (const ev of events) {
      channel.on(ev, (payload) => {
        setList((prev) => [...prev, payload as T]);
      });
    }
    channel.subscribe().catch(() => {});
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { events: list, latest: list[list.length - 1] ?? null };
}
