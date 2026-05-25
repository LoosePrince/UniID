/**
 * 控制台/账号中心使用的浏览器 cookie 会话（UserSession 表）。
 * 与 AppSession（SDK 颁发） 解耦。
 */
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma";
import { ApiError } from "../errors";
import { SESSION_COOKIE_TTL_SECONDS, signUserSessionToken, verifyUserSessionToken } from "./jwt";

export const SESSION_COOKIE_NAME = "uniid_session";

export interface UserSessionDescriptor {
  sessionId: string;
  userId: string;
  username: string;
  role: string;
  csrfToken: string;
}

export async function createUserSession(opts: {
  userId: string;
  username: string;
  role: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; sessionId: string; csrfToken: string }> {
  const now = Math.floor(Date.now() / 1000);
  const csrfToken = randomBytes(16).toString("base64url");

  const session = await prisma.userSession.create({
    data: {
      userId: opts.userId,
      csrfToken,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      expiresAt: now + SESSION_COOKIE_TTL_SECONDS,
      lastSeenAt: now,
      createdAt: now
    }
  });

  const token = await signUserSessionToken({
    sub: opts.userId,
    sid: session.id,
    role: opts.role,
    username: opts.username,
    csrf: csrfToken
  });

  return { token, sessionId: session.id, csrfToken };
}

export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_TTL_SECONDS
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUserSession(): Promise<UserSessionDescriptor | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  let payload;
  try {
    payload = await verifyUserSessionToken(token);
  } catch {
    return null;
  }

  const session = await prisma.userSession.findUnique({ where: { id: payload.sid } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt <= Math.floor(Date.now() / 1000)) return null;

  // 触发 lastSeenAt 更新（非阻塞）
  void prisma.userSession.update({
    where: { id: session.id },
    data: { lastSeenAt: Math.floor(Date.now() / 1000) }
  }).catch(() => {});

  return {
    sessionId: session.id,
    userId: session.userId,
    username: payload.username,
    role: payload.role,
    csrfToken: session.csrfToken
  };
}

export async function requireUserSession(): Promise<UserSessionDescriptor> {
  const s = await getCurrentUserSession();
  if (!s) throw new ApiError("AUTH_SESSION_NOT_FOUND");
  return s;
}

export async function revokeUserSession(sessionId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: now }
  });
}
