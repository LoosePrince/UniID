import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { checkRecordPermission, checkFieldPermission, mergeFieldPermissions } from "@/lib/permissions";
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
  | { valid: true; record: any; userId: string; authType: "full" | "restricted" }
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

  const hasPermission = await checkRecordPermission(
    record.permissions,
    userId,
    record.appId,
    record.ownerId,
    action,
    authType
  );

  if (!hasPermission) {
    return { valid: false, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { valid: true, record, userId, authType };
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

  const { record } = validation;

  return NextResponse.json({
    id: record.id,
    app_id: record.appId,
    owner_id: record.ownerId,
    data_type: record.dataType,
    data: JSON.parse(record.data),
    permissions: JSON.parse(record.permissions),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  });
});

export const PATCH = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { recordId: string } }
): Promise<NextResponse> {
  const { recordId } = context.params;

  // 获取记录
  const record = await prisma.record.findUnique({
    where: { id: recordId }
  });

  if (!record || record.deleted === 1) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // 验证 Origin
  const validation = await validateAppIdOriginMatch(req, record.appId);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "FORBIDDEN" },
      { status: 403 }
    );
  }

  // 验证 Token
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");

  const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, record.appId);
  if (!tokenValidation.valid) {
    return NextResponse.json(
      { error: tokenValidation.error || "INVALID_TOKEN" },
      { status: 401 }
    );
  }

  const userId = tokenValidation.payload!.sub;
  const authType = tokenValidation.payload!.auth_type ?? "restricted";

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
  const currentPermissions = JSON.parse(record.permissions);

  let newData = currentData;
  let newPermissions = currentPermissions;
  let schemaVersion = record.schemaVersion;

  // 检查是否需要记录级 write 权限（修改非字段数据或权限配置）
  const isOwner = record.ownerId === userId;

  if (body.data) {
    // 1. 权限检查：检查每个要更新的字段的权限
    for (const [fieldPath, value] of Object.entries(body.data)) {
      const hasFieldPermission = await checkFieldPermission(
        record.permissions,
        userId,
        record.appId,
        record.ownerId,
        fieldPath,
        "write",
        authType,
        value,  // 传入要写入的数据值，用于动态权限检查
        currentData[fieldPath]  // 传入当前值，用于比较变更
      );

      if (!hasFieldPermission) {
        return NextResponse.json(
          { error: "FIELD_PERMISSION_DENIED", field: fieldPath },
          { status: 403 }
        );
      }
    }

    newData = { ...currentData, ...body.data };

    // 2. 数据验证：执行数据验证
    if (body.skipValidation !== true) {
      const dataValidation = await validateData(record.appId, record.dataType, newData);
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
    }
  }

  if (body.permissions) {
    // 修改权限配置需要记录级 write 权限或管理员权限
    const hasRecordWritePermission = await checkRecordPermission(
      record.permissions,
      userId,
      record.appId,
      record.ownerId,
      "write",
      authType
    );

    if (!hasRecordWritePermission) {
      return NextResponse.json({ error: "PERMISSION_UPDATE_FORBIDDEN" }, { status: 403 });
    }

    newPermissions = mergeFieldPermissions(currentPermissions, body.permissions);
  }

  const updatedRecord = await prisma.record.update({
    where: { id: recordId },
    data: {
      data: JSON.stringify(newData),
      permissions: JSON.stringify(newPermissions),
      updatedAt: now,
      updatedById: userId,
      schemaVersion: schemaVersion as any
    }
  });

  return NextResponse.json({
    id: updatedRecord.id,
    app_id: updatedRecord.appId,
    owner_id: updatedRecord.ownerId,
    data_type: updatedRecord.dataType,
    data: JSON.parse(updatedRecord.data),
    permissions: JSON.parse(updatedRecord.permissions),
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

