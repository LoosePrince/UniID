/**
 * autoFill — 写入前为指定字段填充服务端可信值。
 *
 * 定义示例：
 *   {
 *     "data.createdAt": "$serverTime",
 *     "data.authorId":  "$userId",
 *     "data.ip":        "$ip",
 *     "data.editorId":  "$userId",
 *     "data.version":   1
 *   }
 *
 * 变量：
 *   $serverTime       秒级时间戳
 *   $serverTimeMs     毫秒级时间戳
 *   $userId           当前用户 id
 *   $username         当前用户名
 *   $appId            当前 app id
 *   $ip               请求 IP（route 注入）
 *   $requestId        本次请求 ID
 *   $sessionId        AppSession id
 *
 * 字面量（非字符串或不以 $ 开头的）原样写入。
 */

import type { AuthContext } from "@/shared/policy/variables";

export interface AutoFillContext extends AuthContext {
  requestId?: string;
  ip?: string | null;
  sessionId?: string;
}

export interface AutoFillSpec {
  [pathInRecord: string]: unknown; // path 形如 "data.xxx"
}

function resolveVariable(token: string, ctx: AutoFillContext, op: "create" | "update"): unknown {
  switch (token) {
    case "$serverTime":
      return Math.floor(Date.now() / 1000);
    case "$serverTimeMs":
      return Date.now();
    case "$userId":
      return ctx.userId;
    case "$username":
      return null; // 由 caller 决定要不要附；通常无需
    case "$appId":
      return ctx.appId;
    case "$ip":
      return ctx.ip ?? null;
    case "$requestId":
      return ctx.requestId ?? null;
    case "$sessionId":
      return ctx.sessionId ?? null;
    case "$op":
      return op;
    default:
      return token;
  }
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!k) return;
    if (cur[k] == null || typeof cur[k] !== "object") {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last !== undefined) cur[last] = value;
}

function getByPath(target: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = target;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function applyAutoFill(
  recordEnvelope: { data: Record<string, unknown> } & Record<string, unknown>,
  spec: AutoFillSpec | undefined,
  ctx: AutoFillContext,
  op: "create" | "update"
): void {
  if (!spec) return;
  for (const [path, raw] of Object.entries(spec)) {
    if (typeof raw === "string" && raw.startsWith("$")) {
      const value = resolveVariable(raw, ctx, op);
      // 仅对 create 强制覆盖；update 仅当字段缺失时填充（用户可显式更新）
      if (op === "create" || getByPath(recordEnvelope, path) === undefined) {
        setByPath(recordEnvelope, path, value);
      }
    } else {
      // 字面量：仅 create 时填充默认
      if (op === "create" && getByPath(recordEnvelope, path) === undefined) {
        setByPath(recordEnvelope, path, raw);
      }
    }
  }
}

export function parseAutoFill(raw: string | null | undefined): AutoFillSpec | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as AutoFillSpec;
  } catch {
    return undefined;
  }
}
