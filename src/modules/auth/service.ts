/**
 * AuthService — 业务用例编排：login / register / authorize / refresh / revoke / changePassword
 *
 * 不直接处理 HTTP；所有 HTTP/CORS/zod 由 route 层负责。
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { config } from "@/shared/config";
import {
  hashPassword,
  verifyPassword,
  signAppAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
  issueRefreshToken,
  rotateRefreshToken,
  revokeSession,
  issueActionToken,
  verifyActionToken,
  generateTotpSecret,
  totpUri,
  verifyTotp
} from "@/shared/iam";
import { bus } from "@/shared/bus";
import { escapeHtml, sendMail } from "@/shared/mail";
import { getSystemConfig } from "@/shared/system-config";
import { getAuthSecurityConfig } from "./security-config";

const now = () => Math.floor(Date.now() / 1000);
const REGISTER_EMAIL_CODE_TTL_SECONDS = 10 * 60;

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
  static async login(username: string, password: string, totpCode?: string | null) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_INVALID_CREDENTIALS");
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) throw new ApiError("AUTH_INVALID_CREDENTIALS");
    const authSecurity = await getAuthSecurityConfig();
    if (authSecurity.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) throw new ApiError("AUTH_MFA_REQUIRED");
      if (!verifyTotp(user.twoFactorSecret, totpCode)) throw new ApiError("AUTH_MFA_INVALID");
    }
    return user;
  }

  static async register(input: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
    emailVerificationCode?: string;
    emailVerificationChallenge?: string;
  }) {
    const registrationConfig = await getSystemConfig();
    if (!registrationConfig.registrationEnabled) throw new ApiError("AUTH_REGISTRATION_DISABLED");

    const email = normalizeOptionalEmail(input.email);
    const emailVerifiedAt = registrationConfig.registrationEmailVerificationRequired
      ? verifyRequiredRegistrationEmail(email, input.emailVerificationCode, input.emailVerificationChallenge)
      : undefined;

    const conflicts = await prisma.user.findFirst({
      where: { OR: [{ username: input.username }, ...(email ? [{ email }] : [])] }
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
        email,
        emailVerifiedAt,
        displayName: input.displayName ?? input.username,
        createdAt: t,
        updatedAt: t
      }
    });
    return user;
  }

  static async getRegistrationConfig() {
    const c = await getSystemConfig();
    return {
      registrationEnabled: c.registrationEnabled,
      registrationEmailVerificationRequired: c.registrationEmailVerificationRequired
    };
  }

  static async requestRegistrationEmailCode(emailInput: string) {
    const registrationConfig = await getSystemConfig();
    if (!registrationConfig.registrationEnabled) throw new ApiError("AUTH_REGISTRATION_DISABLED");

    const email = normalizeEmail(emailInput);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError("AUTH_REGISTER_EMAIL_TAKEN");

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const challenge = issueActionToken({
      purpose: "register_email_code",
      userId: "registration",
      email,
      codeHash: hashRegistrationEmailCode(email, code),
      ttlSeconds: REGISTER_EMAIL_CODE_TTL_SECONDS
    });

    const mail = await sendMail({
      to: email,
      subject: "UniID 注册验证码",
      text: `你的 UniID 注册验证码是：${code}\n\n该验证码 10 分钟内有效。如非本人操作，请忽略此邮件。`,
      html: [
        "<p>你的 UniID 注册验证码是：</p>",
        `<p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${escapeHtml(code)}</p>`,
        "<p>该验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p>"
      ].join("")
    });

    return {
      sent: mail.sent,
      challenge,
      expiresIn: REGISTER_EMAIL_CODE_TTL_SECONDS,
      code
    };
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

  static async createEmailVerification(userId: string, baseUrl?: string) {
    const authSecurity = await getAuthSecurityConfig();
    if (!authSecurity.emailVerificationEnabled) throw new ApiError("AUTH_EMAIL_VERIFICATION_DISABLED");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_SESSION_NOT_FOUND");
    if (!user.email) throw new ApiError("AUTH_EMAIL_REQUIRED");
    if (user.emailVerifiedAt) throw new ApiError("AUTH_EMAIL_ALREADY_VERIFIED");
    const token = issueActionToken({
      purpose: "email_verify",
      userId: user.id,
      email: user.email,
      ttlSeconds: 24 * 60 * 60
    });
    const verifyUrl = buildActionUrl(baseUrl, "/api/v1/auth/email/verify", token);
    const mail = verifyUrl
      ? await sendMail({
          to: user.email,
          subject: "验证你的 UniID 邮箱",
          text: `请打开以下链接完成邮箱验证：\n\n${verifyUrl}\n\n该链接 24 小时内有效。`,
          html: [
            "<p>请打开以下链接完成邮箱验证：</p>",
            `<p><a href="${escapeHtml(verifyUrl)}">验证邮箱</a></p>`,
            "<p>该链接 24 小时内有效。</p>"
          ].join("")
        })
      : { sent: false as const, reason: "incomplete" as const };

    return {
      token,
      verifyUrl,
      sent: mail.sent
    };
  }

  static async verifyEmail(token: string) {
    const authSecurity = await getAuthSecurityConfig();
    if (!authSecurity.emailVerificationEnabled) throw new ApiError("AUTH_EMAIL_VERIFICATION_DISABLED");
    const payload = verifyActionToken(token, "email_verify");
    if (!payload) throw new ApiError("AUTH_INVALID_TOKEN");
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_INVALID_TOKEN");
    if (!user.email || user.email !== payload.email) throw new ApiError("AUTH_INVALID_TOKEN");
    if (user.emailVerifiedAt) return { verified: true };
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: now(), updatedAt: now() }
    });
    await bus.publish("auth.email_verified", { userId: user.id, email: user.email, at: now() });
    return { verified: true };
  }

  static async createPasswordReset(identifier: string, baseUrl?: string) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }]
      }
    });
    if (!user || user.deletedAt || !user.email) {
      return { sent: true, token: null, resetUrl: null };
    }
    const token = issueActionToken({
      purpose: "password_reset",
      userId: user.id,
      email: user.email,
      ttlSeconds: 60 * 60
    });
    return {
      sent: true,
      token,
      resetUrl: buildActionUrl(baseUrl, "/api/v1/auth/password/reset", token)
    };
  }

  static async resetPassword(token: string, newPassword: string) {
    const payload = verifyActionToken(token, "password_reset");
    if (!payload) throw new ApiError("AUTH_RESET_TOKEN_INVALID");
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.deletedAt || (payload.email && user.email !== payload.email)) {
      throw new ApiError("AUTH_RESET_TOKEN_INVALID");
    }
    const hashed = await hashPassword(newPassword);
    const t = now();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashed, updatedAt: t }
      }),
      prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: t }
      }),
      prisma.appSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: t }
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: t }
      })
    ]);
    await bus.publish("auth.password_reset", { userId: user.id, at: t });
  }

  static async beginTwoFactorSetup(userId: string) {
    const authSecurity = await getAuthSecurityConfig();
    if (!authSecurity.twoFactorEnabled) throw new ApiError("AUTH_MFA_DISABLED");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_SESSION_NOT_FOUND");
    const secret = generateTotpSecret();
    return {
      secret,
      otpauthUrl: totpUri({
        issuer: "UniID",
        accountName: user.email ?? user.username,
        secret
      })
    };
  }

  static async enableTwoFactor(userId: string, secret: string, code: string) {
    const authSecurity = await getAuthSecurityConfig();
    if (!authSecurity.twoFactorEnabled) throw new ApiError("AUTH_MFA_DISABLED");
    if (!verifyTotp(secret, code)) throw new ApiError("AUTH_MFA_INVALID");
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret, updatedAt: now() }
    });
  }

  static async disableTwoFactor(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new ApiError("AUTH_SESSION_NOT_FOUND");
    if (!user.twoFactorSecret) return;
    if (!verifyTotp(user.twoFactorSecret, code)) throw new ApiError("AUTH_MFA_INVALID");
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, updatedAt: now() }
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

function buildActionUrl(baseUrl: string | undefined, path: string, token: string) {
  if (!baseUrl) return null;
  try {
    const url = new URL(path, baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const normalized = normalizeEmail(email);
  return normalized || undefined;
}

function verifyRequiredRegistrationEmail(
  email: string | undefined,
  code: string | undefined,
  challenge: string | undefined
): number {
  if (!email || !code || !challenge) throw new ApiError("AUTH_REGISTER_EMAIL_VERIFICATION_REQUIRED");
  if (!/^\d{6}$/.test(code)) throw new ApiError("AUTH_REGISTER_EMAIL_VERIFICATION_INVALID");
  const payload = verifyActionToken(challenge, "register_email_code");
  if (!payload?.email || payload.email !== email || !payload.codeHash) {
    throw new ApiError("AUTH_REGISTER_EMAIL_VERIFICATION_INVALID");
  }
  if (!safeEqual(payload.codeHash, hashRegistrationEmailCode(email, code))) {
    throw new ApiError("AUTH_REGISTER_EMAIL_VERIFICATION_INVALID");
  }
  return now();
}

function hashRegistrationEmailCode(email: string, code: string): string {
  return createHmac("sha256", config().AUTH_JWT_SECRET)
    .update(`register_email_code:${email}:${code}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}
