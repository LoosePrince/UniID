import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { 
  checkFieldPermission, 
  getEffectivePermissions, 
  checkAuthorizationScope 
} from "@/lib/permissions";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

function deleteFieldByPath(obj: any, path: string): boolean {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== "object") {
      return false;
    }
    current = current[parts[i]];
  }

  const lastKey = parts[parts.length - 1];
  if (current != null && typeof current === "object" && lastKey in current) {
    delete current[lastKey];
    return true;
  }
  return false;
}

function getFieldByPath(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

export const DELETE = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { recordId: string; fieldPath: string } }
): Promise<NextResponse> {
  const { recordId, fieldPath } = context.params;

  const decodedFieldPath = decodeURIComponent(fieldPath);

  const record = await prisma.record.findUnique({
    where: { id: recordId }
  });

  if (!record || record.deleted === 1) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const validation = await validateAppIdOriginMatch(req, record.appId);
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

  const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, record.appId);
  if (!tokenValidation.valid) {
    return NextResponse.json(
      { error: tokenValidation.error || "INVALID_TOKEN" },
      { status: 401 }
    );
  }

  const userId = tokenValidation.payload!.sub;
  const authType = tokenValidation.payload!.auth_type ?? "restricted";

  // 1. 检查授权作用域
  const authorization = await prisma.authorization.findUnique({
    where: { userId_appId: { userId, appId: record.appId } }
  });
  if (!checkAuthorizationScope(authorization?.permissions ?? null, "delete", record.dataType)) {
    return NextResponse.json({ error: "SCOPE_INSUFFICIENT" }, { status: 403 });
  }

  // 2. 获取有效权限
  const schema = await prisma.dataSchema.findFirst({
    where: { appId: record.appId, dataType: record.dataType, isActive: 1 },
    orderBy: { version: "desc" }
  });
  const effectivePermissions = getEffectivePermissions(schema?.defaultPermissions ?? null, record.permissionOverride);

  // 3. 检查字段权限（移除之前的 restricted 硬编码拦截）
  const hasPermission = await checkFieldPermission(
    effectivePermissions,
    userId,
    record.appId,
    record.ownerId,
    decodedFieldPath,
    "delete",
    authType
  );

  if (!hasPermission) {
    return NextResponse.json(
      { error: "FIELD_DELETE_PERMISSION_DENIED", field: decodedFieldPath },
      { status: 403 }
    );
  }

  const currentData = JSON.parse(record.data);
  const deletedValue = getFieldByPath(currentData, decodedFieldPath);
  const deleted = deleteFieldByPath(currentData, decodedFieldPath);

  if (!deleted) {
    return NextResponse.json(
      { error: "FIELD_NOT_FOUND", field: decodedFieldPath },
      { status: 404 }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const updatedRecord = await prisma.record.update({
    where: { id: recordId },
    data: {
      data: JSON.stringify(currentData),
      updatedAt: now,
      updatedById: userId
    }
  });

  return NextResponse.json({
    success: true,
    deleted_field: decodedFieldPath,
    deleted_value: deletedValue,
    remaining: JSON.parse(updatedRecord.data)
  });
});
