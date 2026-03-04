import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcrypt";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { username, password, email } = (body ?? {}) as {
      username?: string;
      password?: string;
      email?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "USERNAME_AND_PASSWORD_REQUIRED" },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 32) {
      return NextResponse.json(
        { error: "INVALID_USERNAME" },
        { status: 400 }
      );
    }

    if (password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { error: "INVALID_PASSWORD" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { username }
    });

    if (existing) {
      return NextResponse.json(
        { error: "USERNAME_TAKEN" },
        { status: 409 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const passwordHash = await hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        email: email ?? null,
        role: "user",
        createdAt: now,
        updatedAt: now,
        deleted: 0
      }
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      app_id: undefined,
      auth_type: "full"
    });

    const refreshToken = await signRefreshToken({ sub: user.id });
    const expiresIn = 60 * 60;

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
      maxAge: 60 * 60 * 24 * 7
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcrypt";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginAuthRequest(req)) {
      return NextResponse.json(
        { error: "CROSS_ORIGIN_AUTH_FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const { username, password } = body ?? {};

    if (
      !username ||
      typeof username !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { error: "USERNAME_AND_PASSWORD_REQUIRED" },
        { status: 400 }
      );
    }

    if (username.length < 3 || password.length < 6) {
      return NextResponse.json(
        { error: "USERNAME_OR_PASSWORD_TOO_SHORT" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { username }
    });

    if (existing) {
      return NextResponse.json(
        { error: "USERNAME_ALREADY_EXISTS" },
        { status: 409 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const passwordHash = await hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: "user",
        createdAt: now,
        updatedAt: now,
        deleted: 0
      }
    });

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

