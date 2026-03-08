import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSystemAdmin } from "@/lib/permissions";

/**
 * 更新应用管理员 (仅系统管理员)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { appId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { appId } = context.params;

  try {
    const body = await req.json();
    const { adminIds } = body; // 期望是一个用户 ID 数组

    if (!Array.isArray(adminIds)) {
      return NextResponse.json({ error: "INVALID_ADMIN_IDS" }, { status: 400 });
    }

    // 使用事务更新管理员列表
    await prisma.$transaction([
      prisma.appAdmin.deleteMany({ where: { appId } }),
      prisma.appAdmin.createMany({
        data: adminIds.map((userId) => ({
          appId,
          userId,
          createdAt: Math.floor(Date.now() / 1000),
        })),
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * 删除应用 (仅系统管理员)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: { appId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { appId } = context.params;

  try {
    // 软删除应用
    await prisma.app.update({
      where: { id: appId },
      data: { status: "deleted" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
