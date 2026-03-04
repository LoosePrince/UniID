import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function POST(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json({ error: "CROSS_ORIGIN_AUTH_FORBIDDEN" }, { status: 403 });
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");

  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  } else {
    const cookieHeader = req.headers.get("cookie") ?? req.headers.get("Cookie");
    if (cookieHeader) {
      const parts = cookieHeader.split(";").map((p) => p.trim());
      for (const part of parts) {
        if (part.startsWith("uniid_token=")) {
          token = part.substring("uniid_token=".length);
          break;
        }
      }
    }
  }

  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  try {
    await verifyToken(token);

    await prisma.session.deleteMany({
      where: {
        token
      }
    });
    const res = NextResponse.json({ success: true });

    const isProd = process.env.NODE_ENV === "production";

    res.cookies.set("uniid_token", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 0
    });

    res.cookies.set("uniid_refresh_token", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 0
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }
}

