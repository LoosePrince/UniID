import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get("uniid_token")?.value;

  if (!token) {
    return NextResponse.json({ valid: false, user: null, stats: null });
  }

  try {
    const checkRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? ""}/api/auth/check`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      }
    );

    if (!checkRes.ok) {
      return NextResponse.json({ valid: false, user: null, stats: null });
    }

    const authData = await checkRes.json();
    if (!authData.valid || !authData.user) {
      return NextResponse.json({ valid: false, user: null, stats: null });
    }

    const user = authData.user;
    const now = Math.floor(Date.now() / 1000);

    const [appCount, authorizationCount, activeSessionCount, lastSession] =
      await Promise.all([
        prisma.app.count({
          where: { ownerId: user.id }
        }),
        prisma.authorization.count({
          where: {
            userId: user.id,
            revoked: 0
          }
        }),
        prisma.session.count({
          where: {
            userId: user.id,
            expiresAt: {
              gt: now
            }
          }
        }),
        prisma.session.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" }
        })
      ]);

    return NextResponse.json({
      valid: true,
      user,
      stats: {
        appCount,
        authorizationCount,
        activeSessionCount,
        lastLoginAt: lastSession?.createdAt ?? null
      }
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ valid: false, user: null, stats: null }, { status: 500 });
  }
}
