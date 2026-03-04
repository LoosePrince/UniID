import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

export const POST = withDataCors(async function handler(
  req: NextRequest,
  _context: { params: Record<string, string> }
): Promise<NextResponse> {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    await verifyToken(token);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        app_id?: string;
        data_type?: string;
      }
    | null;

  if (!body?.app_id) {
    return NextResponse.json({ error: "APP_ID_REQUIRED" }, { status: 400 });
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

