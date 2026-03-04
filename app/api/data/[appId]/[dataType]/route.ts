import { NextRequest, NextResponse } from "next/server";
import { withDataCors } from "@/lib/cors";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export const POST = withDataCors(async function handler(
  req: NextRequest
): Promise<NextResponse> {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  let userId: string;
  try {
    const payload = await verifyToken(token);
    userId = payload.sub as string;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }

  const { appId, dataType } = req.params as {
    appId: string;
    dataType: string;
  };

  const body = (await req.json().catch(() => null)) as
    | {
        data?: unknown;
        permissions?: unknown;
      }
    | null;

  if (!body?.data) {
    return NextResponse.json({ error: "DATA_REQUIRED" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  const record = await prisma.record.create({
    data: {
      appId,
      ownerId: userId,
      dataType,
      data: JSON.stringify(body.data),
      permissions: JSON.stringify(
        body.permissions ?? {
          default: {
            read: ["$owner", "$app_admin"],
            write: ["$owner"],
            delete: ["$owner"]
          }
        }
      ),
      createdAt: now,
      updatedAt: now,
      createdById: userId,
      updatedById: userId,
      deleted: 0
    }
  });

  return NextResponse.json({
    id: record.id,
    created_at: record.createdAt,
    data: JSON.parse(record.data),
    permissions: JSON.parse(record.permissions)
  });
});

