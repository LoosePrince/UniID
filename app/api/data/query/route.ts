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

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");

  const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, body.app_id);
  if (!tokenValidation.valid) {
    return NextResponse.json(
      { error: tokenValidation.error || "INVALID_TOKEN" },
      { status: 401 }
    );
  }

  const userId = tokenValidation.payload!.sub;
  const authType = tokenValidation.payload!.auth_type ?? "restricted";

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

  // 过滤出有读取权限的记录
  const accessibleRecords = [];
  for (const record of records) {
    const hasPermission = await checkRecordPermission(
      record.permissions,
      userId,
      record.appId,
      record.ownerId,
      "read",
      authType
    );
    if (hasPermission) {
      accessibleRecords.push(record);
    }
  }

  return NextResponse.json({
    total: accessibleRecords.length,
    items: accessibleRecords.map((record) => ({
      id: record.id,
      app_id: record.appId,
      owner_id: record.ownerId,
      data_type: record.dataType,
      data: JSON.parse(record.data),
      permissions: JSON.parse(record.permissions),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    }))
  });
});

