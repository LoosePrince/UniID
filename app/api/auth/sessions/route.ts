import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function GET(req: NextRequest) {
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
      {
        status: auth.status
      }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const sessions = await prisma.session.findMany({
    where: {
      userId: auth.user.id
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  const data = sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent,
    is_current: session.token === auth.token,
    is_active: session.expiresAt > now
  }));

  return NextResponse.json({ sessions: data });
}

export async function DELETE(req: NextRequest) {
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
      {
        status: auth.status
      }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { session_id?: string; all?: boolean }
    | null;

  if (!body) {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { session_id, all } = body;

  if (!session_id && !all) {
    return NextResponse.json(
      { error: "SESSION_ID_OR_ALL_REQUIRED" },
      { status: 400 }
    );
  }

  if (all) {
    await prisma.session.deleteMany({
      where: {
        userId: auth.user.id,
        token: {
          not: auth.token
        }
      }
    });
  } else if (session_id) {
    await prisma.session.deleteMany({
      where: {
        id: session_id,
        userId: auth.user.id
      }
    });
  }

  return NextResponse.json({ success: true });
}

