import { NextRequest, NextResponse } from "next/server";
import { withDataCors } from "@/lib/cors";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export const GET = withDataCors(async function handler(
  req: NextRequest
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

  const { recordId } = req.params as { recordId: string };

  const record = await prisma.record.findUnique({
    where: { id: recordId }
  });

  if (!record || record.deleted === 1) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
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

