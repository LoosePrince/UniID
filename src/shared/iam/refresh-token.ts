import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../prisma";
import { ApiError } from "../errors";

export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const TOKEN_BYTES = 32;

export interface IssuedRefreshToken {
  /** 不透明 token（用户持有） */
  plain: string;
  /** DB 行 id */
  id: string;
}

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssueRefreshInput {
  userId: string;
  sessionId: string;
  parentId?: string;
  rotationCount?: number;
}

export async function issueRefreshToken(input: IssueRefreshInput): Promise<IssuedRefreshToken> {
  const plain = generateOpaqueToken();
  const tokenHash = hashToken(plain);
  const now = Math.floor(Date.now() / 1000);

  const row = await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: input.userId,
      sessionId: input.sessionId,
      parentId: input.parentId,
      rotationCount: input.rotationCount ?? 0,
      expiresAt: now + REFRESH_TOKEN_TTL_SECONDS,
      createdAt: now
    }
  });

  return { plain, id: row.id };
}

/**
 * 轮换：消耗旧 token、签发新 token。
 * - 如果旧 token 已经被使用过（usedAt != null），视为重放攻击，整个会话族 revoke。
 */
export async function rotateRefreshToken(plain: string): Promise<{
  newPlain: string;
  sessionId: string;
  userId: string;
}> {
  const tokenHash = hashToken(plain);
  const now = Math.floor(Date.now() / 1000);

  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw new ApiError("AUTH_INVALID_TOKEN");
  if (existing.revokedAt) throw new ApiError("AUTH_SESSION_REVOKED");
  if (existing.expiresAt <= now) throw new ApiError("AUTH_TOKEN_EXPIRED");

  if (existing.usedAt) {
    // 重放攻击：撤销整个 session 的所有 refresh + session 本身
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { sessionId: existing.sessionId, revokedAt: null },
        data: { revokedAt: now }
      }),
      prisma.appSession.update({
        where: { id: existing.sessionId },
        data: { revokedAt: now }
      })
    ]);
    throw new ApiError("AUTH_REFRESH_REUSED");
  }

  // 标记旧 token 为已使用 + 颁发新 token
  const issued = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { usedAt: now }
    });
    const plainNew = generateOpaqueToken();
    const row = await tx.refreshToken.create({
      data: {
        tokenHash: hashToken(plainNew),
        userId: existing.userId,
        sessionId: existing.sessionId,
        parentId: existing.id,
        rotationCount: existing.rotationCount + 1,
        expiresAt: now + REFRESH_TOKEN_TTL_SECONDS,
        createdAt: now
      }
    });
    return { plainNew, row };
  });

  return {
    newPlain: issued.plainNew,
    sessionId: existing.sessionId,
    userId: existing.userId
  };
}

/** 撤销一个 session 下全部 refresh token + session 本身。 */
export async function revokeSession(sessionId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: now }
    }),
    prisma.appSession.update({
      where: { id: sessionId },
      data: { revokedAt: now }
    })
  ]);
}
