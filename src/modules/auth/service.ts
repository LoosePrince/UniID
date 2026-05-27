/**
 * AuthService — 业务用例编排：login / register / authorize / refresh / revoke / changePassword
 *
 * 不直接处理 HTTP；所有 HTTP/CORS/zod 由 route 层负责。
 */

import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import {
  hashPassword,
  verifyPassword,
  signAppAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
  issueRefreshToken,
  rotateRefreshToken,
  revokeSession
} from "@/shared/iam";
import { bus } from "@/shared/bus";

const now = () => Math.floor(Date.now() / 1000);

export interface CreatedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  authType: "full" | "restricted";
  user: { id: string; username: string; role: string };
  app: { id: string; name: string; primaryDomain: string };
}

export class AuthService {
  /** 用户登录（UniID 控制台/账号中心使用）；不创建 AppSession，仅校验密码并返回用户。 */
  static async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_INVALID_CREDENTIALS");
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) throw new ApiError("AUTH_INVALID_CREDENTIALS");
    return user;
  }

  static async register(input: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
  }) {
    const conflicts = await prisma.user.findFirst({
      where: { OR: [{ username: input.username }, ...(input.email ? [{ email: input.email }] : [])] }
    });
    if (conflicts) {
      if (conflicts.username === input.username) throw new ApiError("AUTH_REGISTER_USERNAME_TAKEN");
      throw new ApiError("AUTH_REGISTER_EMAIL_TAKEN");
    }
    const hashed = await hashPassword(input.password);
    const t = now();
    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash: hashed,
        email: input.email,
        displayName: input.displayName ?? input.username,
        createdAt: t,
        updatedAt: t
      }
    });
    return user;
  }

  /** 用户授权某 app：创建/更新 Authorization + 创建新的 AppSession + 颁发 access/refresh。 */
  static async authorize(input: {
    userId: string;
    appId: string;
    authType: "full" | "restricted";
    scope?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<CreatedSession> {
    const app = await prisma.app.findUnique({ where: { id: input.appId } });
    if (!app) throw new ApiError("APP_NOT_FOUND");
    if (app.status !== "active") throw new ApiError("APP_FORBIDDEN");

    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_INVALID_CREDENTIALS");

    const t = now();
    const scope = input.scope == null ? null : JSON.stringify(input.scope);

    const { authz, session } = await prisma.$transaction(async (tx) => {
      const a = await tx.authorization.upsert({
        where: { userId_appId: { userId: input.userId, appId: input.appId } },
        create: {
          userId: input.userId,
          appId: input.appId,
          authType: input.authType,
          scope,
          grantedAt: t
        },
        update: {
          authType: input.authType,
          scope,
          grantedAt: t,
          revokedAt: null,
          expiresAt: null
        }
      });

      // user×app 在库中仅一行（@@unique）；重复授权时复用该行并轮换 refresh。
      const existing = await tx.appSession.findUnique({
        where: { userId_appId: { userId: input.userId, appId: input.appId } }
      });
      if (existing) {
        await tx.refreshToken.updateMany({
          where: { sessionId: existing.id, revokedAt: null },
          data: { revokedAt: t }
        });
      }

      const s = await tx.appSession.upsert({
        where: { userId_appId: { userId: input.userId, appId: input.appId } },
        create: {
          userId: input.userId,
          appId: input.appId,
          authType: input.authType,
          scope,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          lastSeenAt: t,
          createdAt: t
        },
        update: {
          authType: input.authType,
          scope,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          lastSeenAt: t,
          revokedAt: null
        }
      });

      return { authz: a, session: s };
    });

    const accessToken = await signAppAccessToken({
      sub: input.userId,
      sid: session.id,
      app_id: input.appId,
      auth_type: input.authType,
      role: user.role,
      username: user.username
    });

    const refresh = await issueRefreshToken({ userId: input.userId, sessionId: session.id });

    await bus.publish("authorization.granted", {
      userId: input.userId,
      appId: input.appId,
      authType: input.authType,
      at: t
    });

    return {
      accessToken,
      refreshToken: refresh.plain,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      sessionId: session.id,
      authType: input.authType,
      user: { id: user.id, username: user.username, role: user.role },
      app: { id: app.id, name: app.name, primaryDomain: app.primaryDomain }
    };
  }

  static async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const { newPlain, sessionId, userId } = await rotateRefreshToken(refreshToken);
    const session = await prisma.appSession.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    if (!session || session.revokedAt) throw new ApiError("AUTH_SESSION_REVOKED");

    const accessToken = await signAppAccessToken({
      sub: userId,
      sid: sessionId,
      app_id: session.appId,
      auth_type: session.authType as "full" | "restricted",
      role: session.user.role,
      username: session.user.username
    });

    return {
      accessToken,
      refreshToken: newPlain,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    };
  }

  static async revoke(userId: string, appId: string): Promise<void> {
    const t = now();
    await prisma.$transaction([
      prisma.authorization.updateMany({
        where: { userId, appId, revokedAt: null },
        data: { revokedAt: t }
      }),
      prisma.appSession.updateMany({
        where: { userId, appId, revokedAt: null },
        data: { revokedAt: t }
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId,
          session: { appId },
          revokedAt: null
        },
        data: { revokedAt: t }
      })
    ]);
    await bus.publish("authorization.revoked", { userId, appId, at: t });
  }

  static async revokeBySessionId(sessionId: string): Promise<void> {
    await revokeSession(sessionId);
  }

  static async changePassword(userId: string, oldPw: string, newPw: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError("AUTH_INVALID_CREDENTIALS");
    const ok = await verifyPassword(user.passwordHash, oldPw);
    if (!ok) throw new ApiError("AUTH_CHANGE_PASSWORD_INVALID_OLD");
    const hashed = await hashPassword(newPw);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed, updatedAt: now() }
    });
  }

  /** 列出用户在所有 App 的当前授权（仅活跃）。 */
  static async listAuthorizations(userId: string) {
    return prisma.authorization.findMany({
      where: { userId, revokedAt: null },
      include: { app: { select: { id: true, name: true, primaryDomain: true, description: true } } },
      orderBy: { grantedAt: "desc" }
    });
  }

  static async listAppSessions(userId: string) {
    return prisma.appSession.findMany({
      where: { userId, revokedAt: null },
      include: { app: { select: { id: true, name: true, primaryDomain: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  static async listConsoleSessions(userId: string) {
    return prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }
}
