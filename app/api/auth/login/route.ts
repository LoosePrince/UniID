import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken
} from "@/lib/jwt";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginAuthRequest(req)) {
      return NextResponse.json(
        { error: "CROSS_ORIGIN_AUTH_FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { username, password } = body ?? {};

    if (!username || !password) {
      return NextResponse.json(
        { error: "USERNAME_OR_PASSWORD_REQUIRED" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || user.deleted === 1) {
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const accessToken = await signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      app_id: undefined,
      auth_type: "full"
    });

    const refreshToken = await signRefreshToken({ sub: user.id });

    const expiresIn = ACCESS_TOKEN_TTL_SECONDS;

    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt: now + expiresIn,
        createdAt: now,
        lastActivity: now,
        userAgent: req.headers.get("user-agent") ?? undefined
      }
    });

    const res = NextResponse.json({
      token: accessToken,
      refresh_token: refreshToken,
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
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

