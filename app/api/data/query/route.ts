import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { 
  checkRecordPermission, 
  getEffectivePermissions, 
  filterReadableFields,
  checkAuthorizationScope
} from "@/lib/permissions";

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

  const appId = body.app_id;

  // 验证 app_id 与 Origin 是否匹配
  const validation = await validateAppIdOriginMatch(req, appId);
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
  let authScope: string | null = null;

  // 验证 Token（如果有）
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const origin = req.headers.get("origin") ?? req.headers.get("Origin");

    const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, appId);
    if (tokenValidation.valid) {
      userId = tokenValidation.payload!.sub;
      authType = (tokenValidation.payload as any)!.auth_type ?? "restricted";
      
      // 获取授权作用域
      const authorization = await prisma.authorization.findUnique({
        where: { userId_appId: { userId: userId!, appId } }
      });
      authScope = authorization?.permissions ?? null;
    }
  }

  // 如果有作用域限制且没有指定 data_type，或者 data_type 不在作用域内，需要处理
  if (authScope && body.data_type) {
    if (!checkAuthorizationScope(authScope, "read", body.data_type)) {
      return NextResponse.json({ total: 0, items: [] });
    }
  }

  const where: any = {
    appId,
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

  // 获取该 App 下的所有 Schema，用于计算有效权限
  const schemas = await prisma.dataSchema.findMany({
    where: { appId, isActive: 1 }
  });
  const schemaMap = new Map(schemas.map(s => [s.dataType, s.defaultPermissions]));

  // 过滤记录并执行字段级过滤
  let accessibleRecords = [];
  for (const record of records) {
    // 1. 检查授权作用域（如果请求没带 data_type，这里逐个检查）
    if (authScope && !checkAuthorizationScope(authScope, "read", record.dataType)) {
      continue;
    }

    // 2. 获取有效权限
    const defaultPermissions = schemaMap.get(record.dataType) ?? null;
    const effectivePermissions = getEffectivePermissions(defaultPermissions, record.permissionOverride);

    // 3. 检查记录级权限
    const hasPermission = await checkRecordPermission(
      effectivePermissions,
      userId,
      record.appId,
      record.ownerId,
      "read",
      authType
    );

    if (hasPermission) {
      // 4. 执行字段级读过滤
      const filteredData = await filterReadableFields(
        JSON.parse(record.data),
        effectivePermissions,
        userId,
        record.appId,
        record.ownerId
      );

      accessibleRecords.push({
        ...record,
        data: filteredData,
        effectivePermissions
      });
    }
  }

  // 获取所有者的用户信息
  const ownerIds = Array.from(
    new Set(
      accessibleRecords
        .map((r) => r.ownerId)
        .filter((id): id is string => !!id)
    )
  );
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
      data: record.data,
      permissions: JSON.parse(record.effectivePermissions),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    }))
  });
});
