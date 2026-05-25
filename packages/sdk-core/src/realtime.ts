/**
 * RealtimeNamespace — SSE 长连接 + 频道订阅。
 *
 * 设计：所有频道复用同一个 EventSource 连接，channels 在 URL query 中表达。
 * 切换订阅会重建连接（简化实现；满足 v2 SDK 使用场景）。
 */
import type { AuthNamespace } from "./auth";
import type { UniIDOptions } from "./types";

type RealtimeEvent =
  | { type: "insert"; channel: string; payload: unknown }
  | { type: "update"; channel: string; payload: unknown }
  | { type: "delete"; channel: string; payload: unknown }
  | { type: "broadcast"; channel: string; payload: unknown }
  | { type: "presence"; channel: string; payload: unknown };

type Listener = (ev: RealtimeEvent) => void;

class RealtimeConnection {
  private es: EventSource | null = null;
  private channels = new Set<string>();
  private listeners = new Set<Listener>();
  private lastEventId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly appId: string,
    private readonly getToken: () => string | null
  ) {}

  addChannel(channel: string) {
    this.channels.add(channel);
    this.restart();
  }
  removeChannel(channel: string) {
    this.channels.delete(channel);
    if (this.channels.size === 0) this.close();
    else this.restart();
  }
  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }

  private restart() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    if (this.channels.size === 0 || this.closed) return;

    const u = new URL("/api/v1/realtime/stream", this.url);
    u.searchParams.set("app_id", this.appId);
    u.searchParams.set("channels", Array.from(this.channels).join(","));
    const token = this.getToken();
    if (token) u.searchParams.set("access_token", token);
    if (this.lastEventId) u.searchParams.set("last_event_id", this.lastEventId);

    const es = new EventSource(u.toString(), { withCredentials: false });
    this.es = es;
    es.onmessage = (msg) => {
      if (msg.lastEventId) this.lastEventId = msg.lastEventId;
      try {
        const parsed = JSON.parse(msg.data) as RealtimeEvent;
        for (const fn of this.listeners) {
          try { fn(parsed); } catch {}
        }
      } catch {
        /* ignore malformed lines */
      }
    };
    es.onerror = () => {
      if (this.closed) return;
      es.close();
      this.es = null;
      this.reconnectTimer = setTimeout(() => this.restart(), 1500);
    };
  }
}

export class RealtimeChannel {
  private unsubscribers: Array<() => void> = [];
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(private readonly conn: RealtimeConnection, private readonly channel: string) {}

  on(event: "insert" | "update" | "delete" | "broadcast" | "presence", cb: (payload: unknown) => void): this {
    const set = this.listeners.get(event) ?? new Set<(payload: unknown) => void>();
    set.add(cb);
    this.listeners.set(event, set);
    return this;
  }

  async subscribe(): Promise<this> {
    this.conn.addChannel(this.channel);
    this.unsubscribers.push(
      this.conn.on((ev) => {
        if (ev.channel !== this.channel) return;
        const set = this.listeners.get(ev.type);
        if (!set) return;
        for (const cb of set) {
          try { cb(ev.payload); } catch {}
        }
      })
    );
    return this;
  }

  unsubscribe(): void {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    this.conn.removeChannel(this.channel);
  }
}

export class RealtimeNamespace {
  private conn: RealtimeConnection | null = null;

  constructor(
    private readonly opts: Required<Pick<UniIDOptions, "url" | "appId">>,
    private readonly auth: AuthNamespace
  ) {}

  channel(name: string): RealtimeChannel {
    if (typeof EventSource === "undefined") {
      throw new Error("Realtime requires EventSource (browser-only)");
    }
    if (!this.conn) {
      this.conn = new RealtimeConnection(this.opts.url, this.opts.appId, () => this.auth.accessToken);
    }
    return new RealtimeChannel(this.conn, name);
  }

  close(): void {
    this.conn?.close();
    this.conn = null;
  }
}
