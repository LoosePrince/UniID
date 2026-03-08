import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { validateData } from "@/lib/validation";
import { checkAuthorizationScope } from "@/lib/permissions";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

export const POST = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { appId: string; dataType: string } }
): Promise<NextResponse> {
  const { appId, dataType } = context.params;

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

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");

  const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, appId);
  if (!tokenValidation.valid) {
    return NextResponse.json(
      { error: tokenValidation.error || "INVALID_TOKEN" },
      { status: 401 }
    );
  }

  const userId = tokenValidation.payload!.sub;
  const username = (tokenValidation.payload as any)!.username;
  const authType = (tokenValidation.payload as any)!.auth_type ?? "restricted";

  // 1. 检查授权作用域
  const authorization = await prisma.authorization.findUnique({
    where: { userId_appId: { userId, appId } }
  });
  if (!checkAuthorizationScope(authorization?.permissions ?? null, "write", dataType)) {
    return NextResponse.json({ error: "SCOPE_INSUFFICIENT" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        data?: unknown;
        permissions?: unknown;
        skipValidation?: boolean;
      }
    | null;

  if (!body?.data) {
    return NextResponse.json({ error: "DATA_REQUIRED" }, { status: 400 });
  }

  let schemaVersion: number | null = null;
  let finalData = body.data;
  let defaultPermissions: string | null = null;

  // 2. 获取 Schema 并执行数据验证
  const schema = await prisma.dataSchema.findFirst({
    where: { appId, dataType, isActive: 1 },
    orderBy: { version: "desc" }
  });

  if (schema) {
    defaultPermissions = schema.defaultPermissions;
    if (body.skipValidation !== true) {
      const dataValidation = await validateData(appId, dataType, body.data, { userId, username });
      if (!dataValidation.valid) {
        return NextResponse.json(
          { 
            error: "VALIDATION_FAILED", 
            details: dataValidation.errors,
            schemaVersion: dataValidation.schemaVersion
          },
          { status: 400 }
        );
      }
      schemaVersion = dataValidation.schemaVersion ?? null;
      finalData = dataValidation.data ?? body.data;
    }
  }

  const now = Math.floor(Date.now() / 1000);

  // 3. 处理权限覆盖
  // 如果客户端传入了权限，我们将其存为 permissionOverride
  // 注意：目前我们简单地存储整个传入的权限对象，
  // 理想情况下应该只存储与默认权限不同的部分，但为了保持简单，我们先存储整个对象
  const permissionOverride = body.permissions ? JSON.stringify(body.permissions) : null;

  const record = await prisma.record.create({
    data: {
      appId,
      ownerId: userId,
      dataType,
      data: JSON.stringify(finalData),
      permissionOverride,
      createdAt: now,
      updatedAt: now,
      createdById: userId,
      updatedById: userId,
      deleted: 0,
      schemaVersion: schemaVersion as any
    } as any
  });

  // 返回时解析有效权限
  const { getEffectivePermissions } = await import("@/lib/permissions");
  const effectivePermissions = getEffectivePermissions(defaultPermissions, permissionOverride);

  return NextResponse.json({
    id: record.id,
    created_at: record.createdAt,
    data: JSON.parse(record.data),
    permissions: JSON.parse(effectivePermissions)
  });
});
