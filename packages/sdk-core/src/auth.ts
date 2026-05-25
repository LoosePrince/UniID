/**
 * AuthNamespace — 用户态、登录/登出、session/refresh 管理。
 */
import { request } from "./http";
import { authorizeViaEmbed } from "./embed";
import type {
  AuthChangeListener,
  AuthorizeOptions,
  UniIDOptions,
  UniIDSession,
  UniIDUser
} from "./types";
import type { SessionStorageAdapter } from "./storage";

const REFRESH_LEAD_TIME_SECONDS = 60;

export class AuthNamespace {
  private listeners = new Set<AuthChangeListener>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private session: UniIDSession | null = null;

  constructor(
    private readonly opts: Required<Pick<UniIDOptions, "url" | "appId" | "theme" | "autoRefresh">> &
      Partial<UniIDOptions>,
    private readonly storage: SessionStorageAdapter
  ) {
    this.session = storage.load();
    if (this.session && this.opts.autoRefresh) this.armRefreshTimer();
  }

  get user(): UniIDUser | null {
    return this.session?.user ?? null;
  }

  get accessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  getSession(): UniIDSession | null {
    return this.session;
  }

  onChange(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 调起 iframe 授权（保留现有握手协议）。 */
  async login(options?: AuthorizeOptions): Promise<UniIDUser> {
    const { session } = await authorizeViaEmbed({
      baseUrl: this.opts.url,
      appId: this.opts.appId,
      mount: this.opts.mount,
      theme: this.opts.theme,
      parentOrigin: options?.parentOrigin,
      options
    });
    this.applySession(session);
    return session.user;
  }

  async logout(): Promise<void> {
    if (!this.session) return;
    try {
      await request<void>(this.opts.url, "/api/v1/auth/revoke", {
        method: "POST",
        body: { appId: this.opts.appId, refreshToken: this.session.refreshToken },
        headers: { Authorization: `Bearer ${this.session.accessToken}` }
      });
    } catch {
      /* 本地仍要清；远端失败不阻塞 */
    }
    this.applySession(null);
  }

  /** 主动刷新 access token；返回新 session。 */
  async refresh(): Promise<UniIDSession | null> {
    if (!this.session) return null;
    try {
      const res = await request<{
        session?: UniIDSession;
        token?: string;
        refresh_token?: string;
        expires_in?: number;
      }>(this.opts.url, "/api/v1/auth/refresh", {
        method: "POST",
        body: { refresh_token: this.session.refreshToken }
      });
      const next =
        res.session ??
        (res.token
          ? {
              ...this.session,
              accessToken: res.token,
              refreshToken: res.refresh_token ?? this.session.refreshToken,
              accessTokenExpiresAt:
                Math.floor(Date.now() / 1000) + (res.expires_in ?? 15 * 60)
            }
          : null);
      if (!next) throw new Error("Invalid refresh response");
      this.applySession(next);
      return next;
    } catch (err) {
      this.applySession(null);
      throw err;
    }
  }

  /** 通过 `check` 端点校验当前 session（页面恢复时）。 */
  async check(): Promise<UniIDUser | null> {
    if (!this.session) return null;
    try {
      const res = await request<{ user: UniIDUser }>(this.opts.url, "/api/v1/auth/check", {
        query: { app_id: this.opts.appId },
        headers: { Authorization: `Bearer ${this.session.accessToken}` }
      });
      if (this.session) {
        this.session.user = res.user;
        this.storage.save(this.session);
        this.notify();
      }
      return res.user;
    } catch (err) {
      // 失败 → 尝试刷新；再失败则视为登出
      try {
        const refreshed = await this.refresh();
        return refreshed?.user ?? null;
      } catch {
        return null;
      }
    }
  }

  /** 内部：被 HttpClient 调用以拿到鉴权 header。 */
  authHeader(): Record<string, string> | undefined {
    return this.session ? { Authorization: `Bearer ${this.session.accessToken}` } : undefined;
  }

  /** 由 client 调用：401 时尝试自动刷新一次。 */
  async ensureFreshToken(): Promise<void> {
    if (!this.session) return;
    const skewSec = 5;
    if (this.session.accessTokenExpiresAt - skewSec > Math.floor(Date.now() / 1000)) return;
    await this.refresh();
  }

  private applySession(session: UniIDSession | null) {
    this.session = session;
    this.storage.save(session);
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (session && this.opts.autoRefresh) this.armRefreshTimer();
    this.notify();
  }

  private armRefreshTimer() {
    if (!this.session) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const wait = Math.max(5, this.session.accessTokenExpiresAt - REFRESH_LEAD_TIME_SECONDS - nowSec);
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch(() => {
        /* swallow; next 401 will retry */
      });
    }, wait * 1000);
  }

  private notify() {
    const user = this.session?.user ?? null;
    for (const fn of this.listeners) {
      try { fn(user); } catch {}
    }
  }
}
