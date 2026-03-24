import { getAuthContextFromRequest } from "@/lib/auth-context";
import {
  isSameOriginAuthRequest,
  resolveAllowedAuthOrigin,
  setAuthCorsHeaders
} from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowedOrigin = resolveAllowedAuthOrigin(origin);

  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  const res = new NextResponse(null, { status: 204 });
  setAuthCorsHeaders(res, allowedOrigin);
  return res;
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowedOrigin = resolveAllowedAuthOrigin(origin);

  if (!isSameOriginAuthRequest(req)) {
    const res = NextResponse.json({ valid: false }, { status: 403 });
    if (allowedOrigin) {
      setAuthCorsHeaders(res, allowedOrigin);
    }
    return res;
  }

  const auth = await getAuthContextFromRequest(req);

  if (!auth.ok) {
    const res = NextResponse.json({ valid: false }, { status: auth.status });
    if (allowedOrigin) {
      setAuthCorsHeaders(res, allowedOrigin);
    }
    return res;
  }

  const payload = auth.payload as any;

  // 如果请求中包含 app_id，尝试获取应用信息
  const searchParams = req.nextUrl.searchParams;
  const appId = searchParams.get("app_id");
  let app = null;

  if (appId) {
    app = await prisma.app.findUnique({
      where: { id: appId },
      select: {
        id: true,
        name: true,
        description: true,
        domain: true,
      },
    });
  }

  const res = NextResponse.json({
    valid: true,
    user: {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role
    },
    app,
    app_id: payload.app_id ?? null,
    auth_type: payload.auth_type ?? "full"
  });
  if (allowedOrigin) {
    setAuthCorsHeaders(res, allowedOrigin);
  }
  return res;
}

