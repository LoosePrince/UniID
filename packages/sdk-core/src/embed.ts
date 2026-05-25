/**
 * iframe 嵌入与 postMessage 握手。
 *
 * 协议（与 UniID 后端 /embed 页保持一致）：
 * - 子 → 父：`uniid_ready`  // iframe 加载完成
 * - 父 → 子：`uniid_authorize_request` { appId, parentOrigin, scope? }
 * - 子 → 父：`uniid_login_success`     { authType, accessToken, accessTokenExpiresAt, refreshToken, user }
 * - 子 → 父：`uniid_login_cancel`      { reason? }
 * - 子 → 父：`uniid_resize`            { height }
 */
import type { AuthorizeOptions, UniIDSession, UniIDUser } from "./types";

const HANDSHAKE_TIMEOUT_MS = 60_000;

interface EmbedFrame {
  iframe: HTMLIFrameElement;
  origin: string;
  ready: Promise<void>;
  destroy(): void;
}

function resolveMount(mount: string | HTMLElement | undefined): HTMLElement {
  if (mount instanceof HTMLElement) return mount;
  if (typeof mount === "string") {
    const el = document.querySelector(mount);
    if (el instanceof HTMLElement) return el;
  }
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(20,18,14,0.4);";
  document.body.appendChild(div);
  return div;
}

function buildIframeSrc(baseUrl: string, appId: string, theme: "auto" | "light" | "dark", parentOrigin: string): string {
  const u = new URL("/embed", baseUrl);
  u.searchParams.set("app_id", appId);
  u.searchParams.set("parent_origin", parentOrigin);
  u.searchParams.set("theme", theme);
  return u.toString();
}

export function openEmbed(opts: {
  baseUrl: string;
  appId: string;
  mount: string | HTMLElement | undefined;
  theme: "auto" | "light" | "dark";
  parentOrigin?: string;
}): EmbedFrame {
  if (typeof window === "undefined") throw new Error("openEmbed requires a browser environment");

  const parentOrigin = opts.parentOrigin ?? window.location.origin;
  const baseUrl = opts.baseUrl;
  const expectedOrigin = new URL(baseUrl).origin;
  const mountEl = resolveMount(opts.mount);

  const iframe = document.createElement("iframe");
  iframe.src = buildIframeSrc(baseUrl, opts.appId, opts.theme, parentOrigin);
  iframe.style.cssText =
    "border:0;width:100%;max-width:480px;height:560px;border-radius:16px;background:#FBF9F4;box-shadow:0 12px 48px rgba(20,18,14,0.18);";
  iframe.setAttribute("title", "UniID 授权");
  iframe.setAttribute("allow", "");
  mountEl.appendChild(iframe);

  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((res) => {
    resolveReady = res;
  });

  const onReady = (event: MessageEvent) => {
    if (event.origin !== expectedOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    const data = event.data as { type?: string };
    if (data?.type === "uniid_ready") {
      resolveReady();
    }
    if (data?.type === "uniid_resize" && typeof (data as { height?: unknown }).height === "number") {
      iframe.style.height = `${(data as { height: number }).height}px`;
    }
  };
  window.addEventListener("message", onReady);

  return {
    iframe,
    origin: expectedOrigin,
    ready,
    destroy() {
      window.removeEventListener("message", onReady);
      iframe.remove();
      if (mountEl.children.length === 0 && mountEl.parentElement === document.body) {
        mountEl.remove();
      }
    }
  };
}

export interface AuthorizeResult {
  session: UniIDSession;
}

/** 将 embed 页 postMessage 载荷规范为 UniIDSession。 */
function sessionFromLoginSuccess(
  data: Record<string, unknown>,
  appId: string
): UniIDSession | null {
  if (data.session && typeof data.session === "object") {
    return data.session as UniIDSession;
  }
  const accessToken =
    (typeof data.accessToken === "string" && data.accessToken) ||
    (typeof data.token === "string" && data.token) ||
    null;
  const refreshToken =
    (typeof data.refreshToken === "string" && data.refreshToken) ||
    (typeof data.refresh_token === "string" && data.refresh_token) ||
    null;
  const user = data.user as UniIDUser | undefined;
  if (!accessToken || !refreshToken || !user?.id) return null;

  const expiresIn =
    typeof data.expires_in === "number" ? data.expires_in : 15 * 60;

  return {
    user,
    appId: (typeof data.app_id === "string" && data.app_id) || appId,
    authType:
      data.auth_type === "full" || data.authType === "full" ? "full" : "restricted",
    scope: (data.scope as Record<string, unknown> | null | undefined) ?? null,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + expiresIn
  };
}

export async function authorizeViaEmbed(opts: {
  baseUrl: string;
  appId: string;
  mount: string | HTMLElement | undefined;
  theme: "auto" | "light" | "dark";
  parentOrigin?: string;
  options?: AuthorizeOptions;
}): Promise<AuthorizeResult> {
  const frame = openEmbed(opts);
  try {
    await frame.ready;
    frame.iframe.contentWindow?.postMessage(
      {
        type: "uniid_authorize_request",
        appId: opts.appId,
        parentOrigin: opts.parentOrigin ?? window.location.origin,
        authType: opts.options?.authType,
        scope: opts.options?.scope
      },
      frame.origin
    );

    return await new Promise<AuthorizeResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Authorization timed out"));
      }, HANDSHAKE_TIMEOUT_MS);

      const onMsg = (event: MessageEvent) => {
        if (event.origin !== frame.origin) return;
        if (event.source !== frame.iframe.contentWindow) return;
        const data = event.data as { type?: string };
        if (data?.type === "uniid_resize" && typeof (data as { height?: unknown }).height === "number") {
          frame.iframe.style.height = `${(data as { height: number }).height}px`;
          return;
        }
        if (data?.type === "uniid_login_success") {
          const session = sessionFromLoginSuccess(
            data as Record<string, unknown>,
            opts.appId
          );
          cleanup();
          if (!session) {
            reject(new Error("Invalid authorize response from embed"));
            return;
          }
          resolve({ session });
        }
        if (data?.type === "uniid_login_cancel") {
          cleanup();
          reject(new Error((data as { reason?: string }).reason ?? "User cancelled"));
        }
      };

      function cleanup() {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        frame.destroy();
      }

      window.addEventListener("message", onMsg);
    });
  } catch (err) {
    frame.destroy();
    throw err;
  }
}
