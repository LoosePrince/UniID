import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isAppAdmin, isSystemAdmin } from "@/lib/permissions";
import { handleDataApiOptions, resolveAllowedOrigin, setCorsHeaders } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

/**
 * 更新应用信息 (应用管理员或系统管理员)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { appId: string } }
) {
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");
  const allowedOrigin = await resolveAllowedOrigin(origin);
  if (origin && !allowedOrigin) {
    return NextResponse.json({ error: "CORS_ORIGIN_FORBIDDEN" }, { status: 403 });
  }

  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  }

  const { appId } = context.params;
  const userId = auth.user.id;

  // 权限检查：应用管理员或系统管理员
  const isAdmin = (await isSystemAdmin(userId)) || (await isAppAdmin(appId, userId));

  if (!isAdmin) {
    const res = NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  }

  try {
    const body = await req.json();
    const { name, description, settings, status } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (settings !== undefined) {
      updateData.settings = typeof settings === "string" ? settings : JSON.stringify(settings);
    }
    
    // 只有系统管理员可以修改状态
    if (status !== undefined && (await isSystemAdmin(userId))) {
      updateData.status = status;
    }

    const app = await prisma.app.update({
      where: { id: appId },
      data: updateData,
    });

    const res = NextResponse.json(app);
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  } catch (err) {
    const res = NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  }
}

/**
 * 获取应用详情 (应用管理员或系统管理员)
 * 跨域时需在请求头带 Authorization: Bearer <token>，且请求来源需在应用注册的 domain 中。
 */
export async function GET(
  req: NextRequest,
  context: { params: { appId: string } }
) {
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");
  const allowedOrigin = await resolveAllowedOrigin(origin);
  if (origin && !allowedOrigin) {
    return NextResponse.json({ error: "CORS_ORIGIN_FORBIDDEN" }, { status: 403 });
  }

  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  }

  const { appId } = context.params;
  const userId = auth.user.id;

  const isAdmin = (await isSystemAdmin(userId)) || (await isAppAdmin(appId, userId));

  if (!isAdmin) {
    const res = NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  }

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      owner: {
        select: { id: true, username: true },
      },
      admins: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  if (!app) {
    const res = NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
    setCorsHeaders(res, allowedOrigin ?? null);
    return res;
  }

  const res = NextResponse.json({ ...app, isAdmin: true });
  setCorsHeaders(res, allowedOrigin ?? null);
  return res;
}
