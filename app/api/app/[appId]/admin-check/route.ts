import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

export async function GET(
  req: NextRequest,
  context: { params: { appId: string } }
): Promise<NextResponse> {
  const { appId } = context.params;

  // 从 cookie 获取 token
  const cookieHeader = req.headers.get("cookie") ?? "";
  let token: string | null = null;

  if (cookieHeader) {
    const parts = cookieHeader.split(";").map((p) => p.trim());
    for (const part of parts) {
      if (part.startsWith("uniid_token=")) {
        token = part.substring("uniid_token=".length);
        break;
      }
    }
  }

  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
  }

  try {
    const payload = await verifyToken(token);
    const userId = payload.sub as string;

    const app = await prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      // 应用不存在时也返回 200，统一由前端按“非管理员 / 未配置应用”处理
      return NextResponse.json({ isAdmin: false, appExists: false });
    }

    // 检查是否是应用所有者
    if (app.ownerId === userId) {
      return NextResponse.json({ isAdmin: true, appExists: true });
    }

    // 检查是否在 adminIds 列表中
    if (app.adminIds) {
      try {
        const adminIds: string[] = JSON.parse(app.adminIds);
        if (adminIds.includes(userId)) {
          return NextResponse.json({ isAdmin: true, appExists: true });
        }
      } catch {
        // 解析失败，忽略
      }
    }

    return NextResponse.json({ isAdmin: false, appExists: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }
}
