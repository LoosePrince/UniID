import { revokeAuthorizationForUserAndApp } from "@/lib/authorization-helpers";
import { handleDataApiOptions } from "@/lib/cors";
import { verifyTokenWithAppIdCheck } from "@/lib/jwt";
import { validateAppIdOriginMatch } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";

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

  if (!token && !origin) {
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

  const result = await revokeAuthorizationForUserAndApp({
    userId,
    appId
  });

  if (!result.ok) {
    const res = NextResponse.json(
      { error: result.reason },
      { status: 404 }
    );
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  const res = NextResponse.json({
    success: true,
    message: "Authorization revoked successfully",
    app_id: appId,
    revoked_at: result.revokedAt
  });

  // 确保不清除 UniID 网站的 cookie
  // 之前的逻辑可能会因为 credentials: "include" 导致浏览器在某些情况下误操作，
  // 但这里我们明确不返回 Set-Cookie 响应头来清除 uniid_token。
  // 实际上，只要不调用 res.cookies.set("uniid_token", "", { maxAge: 0 })，UniID 的登录态就是安全的。

  // 添加 CORS 头
  if (allowedOrigin) {
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return res;
}
