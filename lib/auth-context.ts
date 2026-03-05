import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { verifyToken } from "./jwt";
import type { User } from "@prisma/client";

type TokenPayload = Awaited<ReturnType<typeof verifyToken>>;

export type AuthContextSuccess = {
  ok: true;
  user: User;
  token: string;
  payload: TokenPayload;
};

export type AuthContextError = {
  ok: false;
  status: number;
  error: string;
};

export type AuthContextResult = AuthContextSuccess | AuthContextError;

function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookieHeader =
    req.headers.get("cookie") ?? req.headers.get("Cookie") ?? "";
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("uniid_token=")) {
      return part.substring("uniid_token=".length);
    }
  }

  return null;
}

export async function getAuthContextFromRequest(
  req: NextRequest
): Promise<AuthContextResult> {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "MISSING_TOKEN"
    };
  }

  try {
    const payload = await verifyToken(token);
    const userId = payload.sub as string | undefined;

    if (!userId) {
      return {
        ok: false,
        status: 401,
        error: "INVALID_TOKEN"
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.deleted === 1) {
      return {
        ok: false,
        status: 401,
        error: "INVALID_TOKEN"
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const session = await prisma.session.findUnique({
      where: { token }
    });

    if (!session || session.userId !== user.id || session.expiresAt <= now) {
      return {
        ok: false,
        status: 401,
        error: "SESSION_EXPIRED"
      };
    }

    return {
      ok: true,
      user,
      token,
      payload
    };
  } catch {
    return {
      ok: false,
      status: 401,
      error: "INVALID_TOKEN"
    };
  }
}

