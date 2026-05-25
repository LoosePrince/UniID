/**
 * TrustChain — 鉴权 helpers（非装饰器，由 route handler 内调用，便于配合 defineRoute）。
 *
 *   requireConsoleAuth()          → ConsoleAuthContext（基于 cookie 的 UniID 会话）
 *   requireSdkAuth(req)           → SdkAuthContext（bearer + origin + authz 三角校验）
 *   tryGetSdkAuth(req)            → SdkAuthContext | null（同上但允许匿名）
 */

import type { NextRequest } from "next/server";
import { prisma } from "../prisma";
import { ApiError } from "../errors";
import { verifyAppAccessToken, type AppAccessTokenPayload } from "./jwt";
import { getCurrentUserSession, type UserSessionDescriptor } from "./session-store";
import { enforceRateLimit } from "../ratelimit";
import { QuotaService } from "../quota";
import { logger } from "../logger";

export interface SdkAuthContext {
  user: {
    id: string;
    username: string;
    role: string;
  };
  app: {
    id: string;
    primaryDomain: string;
  };
  session: {
    id: string;
    authType: "full" | "restricted";
    scope: unknown;
  };
  /** 已校验过域名匹配的 Origin（仅当跨域请求）。 */
  origin: string | null;
}

export interface ConsoleAuthContext {
  user: {
    id: string;
    username: string;
    role: string;
  };
  session: UserSessionDescriptor;
}

function getBearerToken(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get("access_token");
  if (fromQuery) return fromQuery.trim();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = /(?:^|;\s*)uniid_sdk_token=([^;]+)/.exec(cookieHeader);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

function extractOriginHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

function isLocalHost(host: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const hostname = host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function validateOriginMatch(req: NextRequest, payload: AppAccessTokenPayload): Promise<string | null> {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = extractOriginHost(origin);
  if (!host) throw new ApiError("APP_ORIGIN_MISMATCH");
  if (isLocalHost(host)) return origin;

  const app = await prisma.app.findUnique({
    where: { id: payload.app_id },
    include: { domains: true }
  });
  if (!app) throw new ApiError("APP_NOT_FOUND");
  const matched =
    app.primaryDomain === host ||
    app.domains.some((d) => d.verified === 1 && d.host === host);
  if (!matched) throw new ApiError("APP_ORIGIN_MISMATCH");
  return origin;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function requireSdkAuth(req: NextRequest): Promise<SdkAuthContext> {
  const token = getBearerToken(req);
  if (!token) throw new ApiError("AUTH_INVALID_TOKEN");

  const payload = await verifyAppAccessToken(token);
  const origin = await validateOriginMatch(req, payload);

  const session = await prisma.appSession.findUnique({
    where: { id: payload.sid },
    include: { user: true, app: true }
  });
  if (!session) throw new ApiError("AUTH_SESSION_NOT_FOUND");
  if (session.revokedAt) throw new ApiError("AUTH_SESSION_REVOKED");
  if (session.app.status !== "active") {
    throw new ApiError("APP_FORBIDDEN", { message: "应用已被暂停或归档" });
  }

  const authz = await prisma.authorization.findUnique({
    where: { userId_appId: { userId: session.userId, appId: session.appId } }
  });
  if (!authz) throw new ApiError("AUTH_AUTHORIZATION_NOT_FOUND");
  if (authz.revokedAt) throw new ApiError("AUTH_AUTHORIZATION_REVOKED");
  if (authz.expiresAt != null && authz.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new ApiError("AUTH_AUTHORIZATION_EXPIRED");
  }

  // Rate limit（按 app+ip 双维度的令牌桶）+ 配额（每日 API 调用）
  // 失败时直接抛 ApiError(RATE_LIMITED) / QUOTA_EXCEEDED。
  const quota = await QuotaService.getOrDefault(session.appId);
  const ip = clientIp(req);
  await enforceRateLimit({
    key: `app:${session.appId}:ip:${ip}`,
    capacity: quota.rpsLimit,
    refillPerSecond: quota.rpsLimit
  });
  await QuotaService.consume(session.appId, "apiCalls", 1).catch((err: unknown) => {
    // 配额超限：直接外抛
    if (err instanceof ApiError) throw err;
    logger.warn({ err }, "quota.consume failed (non-fatal)");
  });

  void prisma.appSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: Math.floor(Date.now() / 1000) }
    })
    .catch(() => {});

  return {
    user: { id: session.userId, username: session.user.username, role: session.user.role },
    app: { id: session.appId, primaryDomain: session.app.primaryDomain },
    session: {
      id: session.id,
      authType: session.authType as "full" | "restricted",
      scope: session.scope ? safeParse(session.scope) : null
    },
    origin
  };
}

export async function tryGetSdkAuth(req: NextRequest): Promise<SdkAuthContext | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await requireSdkAuth(req);
  } catch {
    return null;
  }
}

export async function requireConsoleAuth(): Promise<ConsoleAuthContext> {
  const session = await getCurrentUserSession();
  if (!session) throw new ApiError("AUTH_SESSION_NOT_FOUND");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true, deletedAt: true }
  });
  if (!user || user.deletedAt) throw new ApiError("AUTH_SESSION_NOT_FOUND");

  return {
    user: { id: user.id, username: user.username, role: user.role },
    session
  };
}

export async function requireSystemAdmin(): Promise<ConsoleAuthContext> {
  const ctx = await requireConsoleAuth();
  if (ctx.user.role !== "admin") throw new ApiError("APP_FORBIDDEN");
  return ctx;
}

/**
 * 控制台场景：要求当前用户对该 app 有 owner/admin/系统管理员 权限。
 * 给所有 `/api/v1/apps/[appId]/...` 路由复用。
 */
export async function requireAppAccess(
  appId: string
): Promise<ConsoleAuthContext & { app: { id: string; ownerId: string } }> {
  const ctx = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { id: true, ownerId: true, admins: { select: { userId: true } } }
  });
  if (!app) throw new ApiError("APP_NOT_FOUND");
  const isAdmin = ctx.user.role === "admin";
  const isOwner = app.ownerId === ctx.user.id;
  const isAppAdmin = app.admins.some((a: { userId: string }) => a.userId === ctx.user.id);
  if (!isAdmin && !isOwner && !isAppAdmin) {
    throw new ApiError("APP_FORBIDDEN");
  }
  return { ...ctx, app: { id: app.id, ownerId: app.ownerId } };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
