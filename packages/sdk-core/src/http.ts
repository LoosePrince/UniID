/**
 * 轻量 HTTP 客户端：默认 fetch（浏览器 / Node 18+），自动展开错误 envelope。
 */
import type { ApiErrorEnvelope, ApiResponse } from "./types";
import { UniIDError } from "./types";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** 直接传入 FormData / Blob 时设为 false 让浏览器自带 Content-Type。 */
  json?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined | null | boolean>;
  /** 请求是否带 cookie；用于 UniID 自身页面发起的请求。 */
  withCredentials?: boolean;
}

function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export async function request<T>(baseUrl: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = baseUrl.replace(/\/$/, "") + path + buildQuery(opts.query);
  const json = opts.json !== false && !(opts.body instanceof FormData) && !(opts.body instanceof Blob);
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (json && opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body:
      opts.body === undefined
        ? undefined
        : json
        ? JSON.stringify(opts.body)
        : (opts.body as BodyInit),
    credentials: opts.withCredentials ? "include" : "omit",
    signal: opts.signal
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new UniIDError({
        code: "INTERNAL_ERROR",
        message: `Invalid JSON response (status=${res.status})`
      });
    }
  }
  if (!res.ok || (parsed && typeof parsed === "object" && "error" in (parsed as object))) {
    const env = parsed as ApiErrorEnvelope;
    throw new UniIDError(
      env?.error ?? {
        code: "INTERNAL_ERROR",
        message: `Request failed (status=${res.status})`
      }
    );
  }
  const env = parsed as ApiResponse<T>;
  if (env && typeof env === "object" && "data" in env) return (env as { data: T }).data;
  return parsed as T;
}
