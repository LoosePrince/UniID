import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { checkRecordPermission } from "@/lib/permissions";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

export const GET = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { recordId: string } }
): Promise<NextResponse> {
  const { recordId } = context.params;

  // 先查询记录获取 app_id
  const record = await prisma.record.findUnique({
    where: { id: recordId }
  });

  if (!record || record.deleted === 1) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // 验证 app_id 与 Origin 是否匹配
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

  // 检查读取权限
  const hasPermission = await checkRecordPermission(
    record.permissions,
    userId,
    record.appId,
    record.ownerId,
    "read"
  );

  if (!hasPermission) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

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

