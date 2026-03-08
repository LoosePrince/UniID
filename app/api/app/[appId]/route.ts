import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isAppAdmin, isSystemAdmin } from "@/lib/permissions";

/**
 * 更新应用信息 (应用管理员或系统管理员)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { appId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { appId } = context.params;
  const userId = auth.user.id;

  // 权限检查：应用管理员或系统管理员
  const isAdmin = (await isSystemAdmin(userId)) || (await isAppAdmin(appId, userId));

  if (!isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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

    return NextResponse.json(app);
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * 获取应用详情 (应用管理员或系统管理员)
 */
export async function GET(
  req: NextRequest,
  context: { params: { appId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { appId } = context.params;
  const userId = auth.user.id;

  const isAdmin = (await isSystemAdmin(userId)) || (await isAppAdmin(appId, userId));

  if (!isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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
    return NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(app);
}
