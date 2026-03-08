import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSystemAdmin } from "@/lib/permissions";

/**
 * 获取全局配置 (仅系统管理员)
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const client = prisma as unknown as { globalConfig?: { findMany: () => Promise<{ key: string; value: string }[]> } };
  const configs = client.globalConfig
    ? await client.globalConfig.findMany()
    : [];
  const configMap = configs.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);

  return NextResponse.json(configMap);
}

/**
 * 更新全局配置 (仅系统管理员)
 */
export async function PATCH(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "MISSING_KEY" }, { status: 400 });
    }

    const client = prisma as unknown as {
      globalConfig?: {
        upsert: (args: {
          where: { key: string };
          update: { value: string };
          create: { key: string; value: string };
        }) => Promise<{ key: string; value: string }>;
      };
    };
    if (!client.globalConfig) {
      return NextResponse.json(
        { error: "GlobalConfig not available. Run: npx prisma generate" },
        { status: 503 }
      );
    }

    const config = await client.globalConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
