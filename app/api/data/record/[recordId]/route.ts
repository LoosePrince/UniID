import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { 
  checkRecordPermission, 
  checkFieldPermission, 
  mergeFieldPermissions, 
  getEffectivePermissions, 
  filterReadableFields,
  checkAuthorizationScope
} from "@/lib/permissions";
import { validateData } from "@/lib/validation";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

async function validateRequest(
  req: NextRequest,
  recordId: string,
  action: "read" | "write" | "delete"
): Promise<
  | { valid: false; response: NextResponse }
  | { valid: true; record: any; userId: string; authType: "full" | "restricted"; effectivePermissions: string }
> {
  const record = await prisma.record.findUnique({
    where: { id: recordId }
  });

  if (!record || record.deleted === 1) {
    return { valid: false, response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  }

  const validation = await validateAppIdOriginMatch(req, record.appId);
  if (!validation.valid) {
    return {
      valid: false,
      response: NextResponse.json({ error: validation.error || "FORBIDDEN" }, { status: 403 })
    };
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, response: NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 }) };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");

  const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, record.appId);
  if (!tokenValidation.valid) {
    return {
      valid: false,
      response: NextResponse.json({ error: tokenValidation.error || "INVALID_TOKEN" }, { status: 401 })
    };
  }

  const userId = tokenValidation.payload!.sub;
  const authType = tokenValidation.payload!.auth_type ?? "restricted";

  // 1. 检查授权作用域
  const authorization = await prisma.authorization.findUnique({
    where: { userId_appId: { userId, appId: record.appId } }
  });
  if (!checkAuthorizationScope(authorization?.permissions ?? null, action, record.dataType)) {
    return { valid: false, response: NextResponse.json({ error: "SCOPE_INSUFFICIENT" }, { status: 403 }) };
  }

  // 2. 获取有效权限
  const schema = await prisma.dataSchema.findFirst({
    where: { appId: record.appId, dataType: record.dataType, isActive: 1 },
    orderBy: { version: "desc" }
  });
  const effectivePermissions = getEffectivePermissions(schema?.defaultPermissions ?? null, record.permissionOverride);

  // 3. 检查记录级权限
  const hasPermission = await checkRecordPermission(
    effectivePermissions,
    userId,
    record.appId,
    record.ownerId,
    action,
    authType
  );

  if (!hasPermission) {
    return { valid: false, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { valid: true, record, userId, authType, effectivePermissions };
}

export const GET = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { recordId: string } }
): Promise<NextResponse> {
  const { recordId } = context.params;
  const validation = await validateRequest(req, recordId, "read");

  if (!validation.valid) {
    return validation.response;
  }

  const { record, userId, effectivePermissions } = validation;

  // 4. 执行字段级读过滤
  const filteredData = await filterReadableFields(
    JSON.parse(record.data),
    effectivePermissions,
    userId,
    record.appId,
    record.ownerId
  );

  return NextResponse.json({
    id: record.id,
    app_id: record.appId,
    owner_id: record.ownerId,
    data_type: record.dataType,
    data: filteredData,
    permissions: JSON.parse(effectivePermissions),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  });
});

export const PATCH = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { recordId: string } }
): Promise<NextResponse> {
  const { recordId } = context.params;
  
  // 使用 validateRequest 进行基础验证和权限检查
  const validation = await validateRequest(req, recordId, "write");
  if (!validation.valid) {
    return validation.response;
  }

  const { record, userId, authType, effectivePermissions } = validation;
  const username = (await prisma.user.findUnique({ where: { id: userId }, select: { username: true } }))?.username || "";

  // 解析请求体
  const body = (await req.json().catch(() => null)) as
    | {
        data?: Record<string, any>;
        permissions?: Record<string, any>;
        skipValidation?: boolean;
      }
    | null;

  if (!body || (!body.data && !body.permissions)) {
    return NextResponse.json({ error: "DATA_OR_PERMISSIONS_REQUIRED" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const currentData = JSON.parse(record.data);
  
  let newData = currentData;
  let newPermissionOverride = record.permissionOverride;
  let schemaVersion = record.schemaVersion;

  if (body.data) {
    // 5. 字段级写权限检查
    for (const [fieldPath, value] of Object.entries(body.data)) {
      const isNewField = currentData[fieldPath] === undefined;
      const action = isNewField ? "create" : "update";

      const hasFieldPermission = await checkFieldPermission(
        effectivePermissions,
        userId,
        record.appId,
        record.ownerId,
        fieldPath,
        action,
        authType,
        value,
        currentData[fieldPath]
      );

      if (!hasFieldPermission) {
        return NextResponse.json(
          { error: "FIELD_PERMISSION_DENIED", field: fieldPath, action },
          { status: 403 }
        );
      }
    }

    newData = { ...currentData, ...body.data };

    // 6. 数据验证
    if (body.skipValidation !== true) {
      const dataValidation = await validateData(record.appId, record.dataType, newData, { 
        userId, 
        username,
        prevData: currentData 
      });
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
      newData = dataValidation.data ?? newData;
      schemaVersion = dataValidation.schemaVersion ?? null;
    }
  }

  if (body.permissions) {
    // 修改权限配置需要记录级 write 权限，validateRequest 已经检查过了
    // 我们将更新后的权限存入 permissionOverride
    const currentOverrideObj = record.permissionOverride ? JSON.parse(record.permissionOverride) : {};
    const updatedOverrideObj = mergeFieldPermissions(currentOverrideObj, body.permissions);
    newPermissionOverride = JSON.stringify(updatedOverrideObj);
  }

  const updatedRecord = await prisma.record.update({
    where: { id: recordId },
    data: {
      data: JSON.stringify(newData),
      permissionOverride: newPermissionOverride,
      updatedAt: now,
      updatedById: userId,
      schemaVersion: schemaVersion as any
    } as any
  });

  // 重新计算有效权限用于返回
  const schema = await prisma.dataSchema.findFirst({
    where: { appId: record.appId, dataType: record.dataType, isActive: 1 },
    orderBy: { version: "desc" }
  });
  const finalEffectivePermissions = getEffectivePermissions(schema?.defaultPermissions ?? null, updatedRecord.permissionOverride);

  return NextResponse.json({
    id: updatedRecord.id,
    app_id: updatedRecord.appId,
    owner_id: updatedRecord.ownerId,
    data_type: updatedRecord.dataType,
    data: newData, // 这里可以考虑是否也需要 filterReadableFields
    permissions: JSON.parse(finalEffectivePermissions),
    created_at: updatedRecord.createdAt,
    updated_at: updatedRecord.updatedAt
  });
});

export const DELETE = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { recordId: string } }
): Promise<NextResponse> {
  const { recordId } = context.params;
  const validation = await validateRequest(req, recordId, "delete");

  if (!validation.valid) {
    return validation.response;
  }

  const { record, userId } = validation;
  const now = Math.floor(Date.now() / 1000);

  await prisma.record.update({
    where: { id: recordId },
    data: {
      deleted: 1,
      updatedAt: now,
      updatedById: userId
    }
  });

  return NextResponse.json({ success: true, deleted: recordId });
});
