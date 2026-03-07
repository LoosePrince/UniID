import { handleDataApiOptions, withDataCors } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

/**
 * 注册或更新数据模式 (Data Schema)
 * POST /api/schema/[appId]/[dataType]
 */
export const POST = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { appId: string; dataType: string } }
): Promise<NextResponse> {
  const { appId, dataType } = context.params;

  // 1. 验证 app_id 与 Origin 是否匹配
  const validation = await validateAppIdOriginMatch(req, appId);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "FORBIDDEN" },
      { status: 403 }
    );
  }

  // 2. 验证 Token
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
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

  // 3. 权限检查：只有应用所有者或管理员可以定义 Schema
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { ownerId: true, adminIds: true }
  });

  if (!app) {
    return NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
  }

  const isAdmin = app.ownerId === userId ||
    (app.adminIds && JSON.parse(app.adminIds).includes(userId));

  if (!isAdmin) {
    return NextResponse.json({ error: "UNAUTHORIZED_SCHEMA_ADMIN" }, { status: 403 });
  }

  // 4. 解析请求体
  const body = (await req.json().catch(() => null)) as {
    schema?: any;
    description?: string;
    validationRules?: string;
    isActive?: boolean;
  } | null;

  if (!body?.schema) {
    return NextResponse.json({ error: "SCHEMA_REQUIRED" }, { status: 400 });
  }

  // 验证 schema 是否为有效的 JSON Schema (简单检查)
  try {
    if (typeof body.schema === "string") {
      JSON.parse(body.schema);
    } else {
      JSON.stringify(body.schema);
    }
  } catch (e) {
    return NextResponse.json({ error: "INVALID_JSON_SCHEMA" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  // 5. 获取当前最大版本号
  const lastSchema = await prisma.dataSchema.findFirst({
    where: { appId, dataType },
    orderBy: { version: "desc" },
    select: { version: true }
  });

  const nextVersion = (lastSchema?.version ?? 0) + 1;

  // 6. 如果新版本设为活跃，则将旧版本设为不活跃
  if (body.isActive !== false) {
    await prisma.dataSchema.updateMany({
      where: { appId, dataType, isActive: 1 },
      data: { isActive: 0 }
    });
  }

  // 7. 创建新版本 Schema
  const newSchema = await prisma.dataSchema.create({
    data: {
      appId,
      dataType,
      schema: typeof body.schema === "string" ? body.schema : JSON.stringify(body.schema),
      version: nextVersion,
      isActive: body.isActive !== false ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      createdById: userId,
      description: body.description,
      validationRules: body.validationRules
    }
  });

  return NextResponse.json({
    id: newSchema.id,
    version: newSchema.version,
    isActive: newSchema.isActive === 1,
    dataType: newSchema.dataType,
    createdAt: newSchema.createdAt
  });
});

/**
 * 获取数据模式
 * GET /api/schema/[appId]/[dataType]
 */
export const GET = withDataCors(async function handler(
  req: NextRequest,
  context: { params: { appId: string; dataType: string } }
): Promise<NextResponse> {
  const { appId, dataType } = context.params;
  const { searchParams } = new URL(req.url);
  const version = searchParams.get("version");

  const where: any = { appId, dataType };
  if (version) {
    where.version = parseInt(version);
  } else {
    where.isActive = 1;
  }

  const schema = await prisma.dataSchema.findFirst({
    where,
    orderBy: { version: "desc" }
  });

  if (!schema) {
    return NextResponse.json({ error: "SCHEMA_NOT_FOUND" }, { status: 200 });
  }

  return NextResponse.json({
    id: schema.id,
    version: schema.version,
    isActive: schema.isActive === 1,
    schema: JSON.parse(schema.schema),
    description: schema.description,
    validationRules: schema.validationRules,
    createdAt: schema.createdAt
  });
});
