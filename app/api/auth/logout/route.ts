import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOriginAuthRequest } from "@/lib/origin";
import { getAuthContextFromRequest } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json(
      { error: "CROSS_ORIGIN_AUTH_FORBIDDEN" },
      { status: 403 }
    );
  }

  const auth = await getAuthContextFromRequest(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  await prisma.session.deleteMany({
    where: {
      token: auth.token
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
}

