import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { isSameOriginAuthRequest } from "@/lib/origin";
import { handleDataApiOptions } from "@/lib/cors";

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  return handleDataApiOptions(req);
}

export async function GET(
  req: NextRequest,
  context: { params: { appId: string } }
): Promise<NextResponse> {
  const { appId } = context.params;
  const originHeader =
    req.headers.get("origin") ?? req.headers.get("Origin") ?? null;

  // 1. UniID 本站 / 内部调用：保持原有行为（cookie + verifyToken）
  if (isSameOriginAuthRequest(req)) {
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
        return NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
      }

      // 检查是否是应用所有者
      if (app.ownerId === userId) {
        return NextResponse.json({ isAdmin: true });
      }

      // 检查是否在 adminIds 列表中
      if (app.adminIds) {
        try {
          const adminIds: string[] = JSON.parse(app.adminIds);
          if (adminIds.includes(userId)) {
            return NextResponse.json({ isAdmin: true });
          }
        } catch {
          // 解析失败，忽略
        }
      }

      return NextResponse.json({ isAdmin: false });
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
    }
  }

  // 2. 应用侧调用：要求 Origin 与 appId 匹配，且提供授权 Token
  if (!originHeader) {
    return NextResponse.json(
      { error: "ORIGIN_REQUIRED" },
      { status: 403 }
    );
  }

  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    const res = NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
    res.headers.set("Access-Control-Allow-Origin", originHeader);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    return res;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  const validation = await verifyTokenWithAppIdCheck(token, originHeader, appId);
  if (!validation.valid || !validation.payload) {
    const status =
      validation.error === "APP_ID_ORIGIN_MISMATCH" ? 403 : 401;
    const res = NextResponse.json(
      { error: validation.error ?? "INVALID_TOKEN" },
      { status }
    );
    res.headers.set("Access-Control-Allow-Origin", originHeader);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    return res;
  }

  const userId = validation.payload.sub as string;

  const app = await prisma.app.findUnique({
    where: { id: appId }
  });

  if (!app) {
    const res = NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
    res.headers.set("Access-Control-Allow-Origin", originHeader);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    return res;
  }

  let isAdmin = false;

  if (app.ownerId === userId) {
    isAdmin = true;
  } else if (app.adminIds) {
    try {
      const adminIds: string[] = JSON.parse(app.adminIds);
      if (adminIds.includes(userId)) {
        isAdmin = true;
      }
    } catch {
      // ignore parse error
    }
  }

  const res = NextResponse.json({ isAdmin });
  res.headers.set("Access-Control-Allow-Origin", originHeader);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}
