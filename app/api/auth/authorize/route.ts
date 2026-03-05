import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  verifyToken,
  signAccessToken,
  signRefreshToken
} from "@/lib/jwt";
import { isSameOriginAuthRequest, validateAppIdOriginMatch } from "@/lib/origin";

export async function POST(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json(
      { error: "CROSS_ORIGIN_AUTH_FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { app_id?: string; auth_type?: string }
    | null;

  const appId = body?.app_id;
  const authType = body?.auth_type;

  if (!appId || (authType !== "full" && authType !== "restricted")) {
    return NextResponse.json(
      { error: "INVALID_AUTH_REQUEST" },
      { status: 400 }
    );
  }

  // 验证 app_id 与 Origin 是否匹配
  const validation = await validateAppIdOriginMatch(req, appId);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "FORBIDDEN" },
      { status: 403 }
    );
  }

  const cookieHeader =
    req.headers.get("cookie") ?? req.headers.get("Cookie") ?? "";
  let accessToken: string | null = null;

  if (cookieHeader) {
    const parts = cookieHeader.split(";").map((p) => p.trim());
    for (const part of parts) {
      if (part.startsWith("uniid_token=")) {
        accessToken = part.substring("uniid_token=".length);
        break;
      }
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  let userId: string;
  try {
    const payload = await verifyToken(accessToken);
    if (!payload.sub) {
      throw new Error("NO_SUBJECT");
    }
    userId = payload.sub as string;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || user.deleted === 1) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);

  let app = await prisma.app.findUnique({
    where: { id: appId }
  });

  if (!app) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "APP_NOT_REGISTERED" }, { status: 400 });
    }

    const domain =
      process.env.DEV_DEFAULT_APP_DOMAIN ??
      "localhost:3000";

    app = await prisma.app.create({
      data: {
        id: appId,
        name: appId,
        domain,
        description: "Demo app created automatically in development",
        createdAt: now,
        ownerId: user.id,
        status: "active",
        apiKey: null,
        settings: null
      }
    });
  }

  await prisma.authorization.upsert({
    where: {
      userId_appId: {
        userId: user.id,
        appId: app.id
      }
    },
    update: {
      authType,
      grantedAt: now,
      expiresAt: now + 60 * 60 * 24 * 30, // 应用授权有效期：30 天
      revoked: 0
    },
    create: {
      userId: user.id,
      appId: app.id,
      authType,
      grantedAt: now,
      expiresAt: now + 60 * 60 * 24 * 30,
      revoked: 0,
      permissions: null
    }
  });

  const appAccessToken = await signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    app_id: app.id,
    auth_type: authType
  });

  const refreshToken = await signRefreshToken({ sub: user.id });
  const expiresIn = ACCESS_TOKEN_TTL_SECONDS;

  await prisma.session.create({
    data: {
      userId: user.id,
      token: appAccessToken,
      refreshToken,
      expiresAt: now + expiresIn,
      createdAt: now,
      lastActivity: now,
      userAgent: req.headers.get("user-agent") ?? undefined
    }
  });

  const res = NextResponse.json({
    token: appAccessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    app_id: app.id,
    auth_type: authType
  });

  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set("uniid_token", appAccessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: expiresIn
  });

  res.cookies.set("uniid_refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS
  });

  return res;
}

