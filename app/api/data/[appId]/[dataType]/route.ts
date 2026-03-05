import { NextRequest, NextResponse } from "next/server";
import { withDataCors, handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { validateAppIdOriginMatch } from "@/lib/origin";

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

