import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSystemAdmin } from "@/lib/permissions";

/**
 * 获取当前用户可管理的应用列表（用于应用设置）
 * - UniID 管理员：返回所有应用
 * - 应用管理员：仅返回其作为 owner 或 AppAdmin 的应用
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;
  const sysAdmin = await isSystemAdmin(userId);

  if (sysAdmin) {
    const apps = await prisma.app.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        description: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(apps);
  }

  const apps = await prisma.app.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { admins: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      domain: true,
      description: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apps);
}
