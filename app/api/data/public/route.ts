import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";

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

  return NextResponse.json({
    total: records.length,
    items: records.map((record) => ({
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
