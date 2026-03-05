import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { checkRecordPermission } from "@/lib/permissions";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

export const POST = withDataCors(async function handler(
  req: NextRequest,
  _context: { params: Record<string, string> }
): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | {
        app_id?: string;
        data_type?: string;
      }
    | null;

  if (!body?.app_id) {
    return NextResponse.json({ error: "APP_ID_REQUIRED" }, { status: 400 });
  }

  // 验证 app_id 与 Origin 是否匹配
  const validation = await validateAppIdOriginMatch(req, body.app_id);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "FORBIDDEN" },
      { status: 403 }
    );
  }

  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  let userId: string | null = null;
  let authType: "full" | "restricted" = "restricted";
  let isAuthenticated = false;

  // 验证 Token（如果有）
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const origin = req.headers.get("origin") ?? req.headers.get("Origin");

    const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, body.app_id);
    if (tokenValidation.valid) {
      userId = tokenValidation.payload!.sub;
      authType = tokenValidation.payload!.auth_type ?? "restricted";
      isAuthenticated = true;
    }
  }

  const where: {
    appId: string;
    dataType?: string;
    deleted: number;
  } = {
    appId: body.app_id,
    deleted: 0
  };

  if (body.data_type) {
    where.dataType = body.data_type;
  }

  const records = await prisma.record.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    }
  });

  // 过滤记录 - 对所有用户（包括未登录）进行权限检查
  let accessibleRecords = [];
  for (const record of records) {
    const hasPermission = await checkRecordPermission(
      record.permissions,
      userId,  // 未登录时为 null
      record.appId,
      record.ownerId,
      "read",
      authType
    );
    if (hasPermission) {
      accessibleRecords.push(record);
    }
  }

  // 获取所有者的用户信息
  const ownerIds = [...new Set(accessibleRecords.map(r => r.ownerId).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: {
      id: { in: ownerIds }
    },
    select: {
      id: true,
      username: true
    }
  });
  const userMap = new Map(users.map(u => [u.id, u.username]));

  return NextResponse.json({
    total: accessibleRecords.length,
    items: accessibleRecords.map((record) => ({
      id: record.id,
      app_id: record.appId,
      owner_id: record.ownerId,
      owner_name: record.ownerId ? userMap.get(record.ownerId) || "未知用户" : "未知用户",
      data_type: record.dataType,
      data: JSON.parse(record.data),
      permissions: JSON.parse(record.permissions),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    }))
  });
});
