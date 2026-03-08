import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isAppAdmin, isSystemAdmin } from "@/lib/permissions";

/**
 * 获取应用的所有 DataSchema (应用管理员或系统管理员)
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

  const schemas = await prisma.dataSchema.findMany({
    where: { appId },
    orderBy: [{ dataType: "asc" }, { version: "desc" }],
  });

  return NextResponse.json(schemas);
}
