import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { verifyToken } from "@/lib/jwt";
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

  const authorizations = await prisma.authorization.findMany({
    where: {
      userId: auth.user.id,
      revoked: 0
    },
    include: {
      app: true
    }
  });

  const data = authorizations.map((authorization) => ({
    id: authorization.id,
    appId: authorization.appId,
    appName: authorization.app?.name ?? authorization.appId,
    domain: authorization.app?.domain ?? null,
    authType: authorization.authType,
    grantedAt: authorization.grantedAt,
    expiresAt: authorization.expiresAt ?? null
  }));

  return NextResponse.json({ authorizations: data });
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
    | {
        app_id?: string;
        authorization_id?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { app_id, authorization_id } = body;

  if (!app_id && !authorization_id) {
    return NextResponse.json(
      { error: "APP_ID_OR_AUTHORIZATION_ID_REQUIRED" },
      { status: 400 }
    );
  }

  const where =
    authorization_id != null
      ? { id: authorization_id, userId: auth.user.id }
      : {
          userId_appId: {
            userId: auth.user.id,
            appId: app_id as string
          }
        };

  const existing = await prisma.authorization.findFirst({
    where:
      "id" in where
        ? { id: where.id, userId: where.userId, revoked: 0 }
        : {
            userId: where.userId_appId.userId,
            appId: where.userId_appId.appId,
            revoked: 0
          }
  });

  if (!existing) {
    return NextResponse.json(
      { error: "AUTHORIZATION_NOT_FOUND" },
      { status: 404 }
    );
  }

  await prisma.authorization.update({
    where: {
      id: existing.id
    },
    data: {
      revoked: 1
    }
  });

  const now = Math.floor(Date.now() / 1000);
  const appId = existing.appId;

  const sessions = await prisma.session.findMany({
    where: {
      userId: auth.user.id
    }
  });

  const sessionIdsToExpire: string[] = [];

  for (const session of sessions) {
    try {
      const payload = await verifyToken(session.token);
      if ((payload as any).app_id === appId) {
        sessionIdsToExpire.push(session.id);
      }
    } catch {
      // ignore invalid tokens
    }
  }

  if (sessionIdsToExpire.length > 0) {
    await prisma.session.updateMany({
      where: {
        id: {
          in: sessionIdsToExpire
        }
      },
      data: {
        expiresAt: now
      }
    });
  }

  return NextResponse.json({
    success: true,
    app_id: appId,
    revoked_at: now
  });
}

