import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyToken
} from "@/lib/jwt";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function POST(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json(
      { error: "CROSS_ORIGIN_AUTH_FORBIDDEN" },
      { status: 403 }
    );
  }
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "MISSING_REFRESH_TOKEN" }, { status: 401 });
  }

  const refreshToken = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = await verifyToken<{ sub: string }>(refreshToken);

    const session = await prisma.session.findFirst({
      where: {
        refreshToken
      }
    });

    if (!session) {
      return NextResponse.json({ error: "INVALID_REFRESH_TOKEN" }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt < now) {
      return NextResponse.json({ error: "REFRESH_TOKEN_EXPIRED" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    });

    if (!user || user.deleted === 1) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      app_id: undefined,
      auth_type: "full"
    });

    const newRefreshToken = await signRefreshToken({ sub: user.id });
    const expiresIn = ACCESS_TOKEN_TTL_SECONDS;

    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: accessToken,
        refreshToken: newRefreshToken,
        expiresAt: now + expiresIn,
        lastActivity: now
      }
    });

    const res = NextResponse.json({
      token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: expiresIn,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

    const isProd = process.env.NODE_ENV === "production";

    res.cookies.set("uniid_token", accessToken, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS
    });

    res.cookies.set("uniid_refresh_token", newRefreshToken, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "INVALID_REFRESH_TOKEN" }, { status: 401 });
  }
}

