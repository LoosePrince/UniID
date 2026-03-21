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
    const { adminIds, status, domain } = body;
    const hasAdminIds = adminIds !== undefined;
    const hasStatus = status !== undefined;
    const hasDomain = domain !== undefined;

    if (!hasAdminIds && !hasStatus && !hasDomain) {
      return NextResponse.json({ error: "NO_UPDATABLE_FIELDS" }, { status: 400 });
    }

    if (hasStatus && status !== "active" && status !== "deleted") {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }

    if (hasDomain && typeof domain !== "string") {
      return NextResponse.json({ error: "INVALID_DOMAIN" }, { status: 400 });
    }

    const normalizedDomain = hasDomain ? domain.trim() : undefined;
    if (hasDomain && !normalizedDomain) {
      return NextResponse.json({ error: "INVALID_DOMAIN" }, { status: 400 });
    }

    // 管理员列表更新与应用字段更新允许同时提交，统一放进事务中保证一致性
    await prisma.$transaction(async (tx) => {
      if (hasAdminIds) {
        if (!Array.isArray(adminIds)) {
          throw new Error("INVALID_ADMIN_IDS");
        }
        await tx.appAdmin.deleteMany({ where: { appId } });
        if (adminIds.length > 0) {
          await tx.appAdmin.createMany({
            data: adminIds.map((userId) => ({
              appId,
              userId,
              createdAt: Math.floor(Date.now() / 1000),
            })),
          });
        }
      }

      if (hasStatus || hasDomain) {
        const updateData: { status?: "active" | "deleted"; domain?: string } = {};
        if (hasStatus) updateData.status = status;
        if (hasDomain && normalizedDomain) updateData.domain = normalizedDomain;
        await tx.app.update({
          where: { id: appId },
          data: updateData,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof Error && err.message === "INVALID_ADMIN_IDS") {
      return NextResponse.json({ error: "INVALID_ADMIN_IDS" }, { status: 400 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "DOMAIN_TAKEN" }, { status: 409 });
    }
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
