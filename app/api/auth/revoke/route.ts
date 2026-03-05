import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { handleDataApiOptions } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return handleDataApiOptions(req);
}

export async function POST(req: NextRequest) {
  // 处理 CORS
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");
  const allowedOrigin = origin;

  const body = (await req.json().catch(() => null)) as
    | { app_id?: string }
    | null;

  const appId = body?.app_id;

  if (!appId) {
    const res = NextResponse.json(
      { error: "APP_ID_REQUIRED" },
      { status: 400 }
    );
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  // 验证 app_id 与 Origin 是否匹配（替代同域检查）
  const validation = await validateAppIdOriginMatch(req, appId);
  if (!validation.valid) {
    const res = NextResponse.json(
      { error: validation.error || "FORBIDDEN" },
      { status: 403 }
    );
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  // 从请求头获取 token
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  }

  if (!token) {
    // 尝试从 cookie 获取
    const cookieHeader =
      req.headers.get("cookie") ?? req.headers.get("Cookie") ?? "";
    if (cookieHeader) {
      const parts = cookieHeader.split(";").map((p) => p.trim());
      for (const part of parts) {
        if (part.startsWith("uniid_token=")) {
          token = part.substring("uniid_token=".length);
          break;
        }
      }
    }
  }

  if (!token) {
    const res = NextResponse.json({ error: "MISSING_TOKEN" }, { status: 401 });
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  const tokenValidation = await verifyTokenWithAppIdCheck(token, origin, appId);
  if (!tokenValidation.valid) {
    const res = NextResponse.json(
      { error: tokenValidation.error || "INVALID_TOKEN" },
      { status: 401 }
    );
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  const userId = tokenValidation.payload!.sub;

  const now = Math.floor(Date.now() / 1000);

  // 查找并更新授权记录
  const authorization = await prisma.authorization.findUnique({
    where: {
      userId_appId: {
        userId: userId,
        appId: appId
      }
    }
  });

  if (!authorization) {
    const res = NextResponse.json(
      { error: "AUTHORIZATION_NOT_FOUND" },
      { status: 404 }
    );
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  // 标记授权为已撤销
  await prisma.authorization.update({
    where: {
      userId_appId: {
        userId: userId,
        appId: appId
      }
    },
    data: {
      revoked: 1
    }
  });

  // 使该用户的所有相关会话过期
  await prisma.session.updateMany({
    where: {
      userId: userId,
      token: {
        startsWith: token.substring(0, 20) // 匹配当前 token 开头的会话
      }
    },
    data: {
      expiresAt: now
    }
  });

  const res = NextResponse.json({
    success: true,
    message: "Authorization revoked successfully",
    app_id: appId,
    revoked_at: now
  });

  // 添加 CORS 头
  if (allowedOrigin) {
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return res;
}
