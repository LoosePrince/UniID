import type { NextRequest, NextResponse } from "next/server";

const AUTH_ORIGINS_ENV = process.env.AUTH_ALLOWED_ORIGINS;

function getAllowedAuthOrigins(): string[] {
  if (AUTH_ORIGINS_ENV && AUTH_ORIGINS_ENV.trim().length > 0) {
    return AUTH_ORIGINS_ENV
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  const url = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  return url ? [url] : [];
}

export function isSameOriginAuthRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // 非浏览器跨域 XHR（如 curl / 服务器内部调用），允许通过
    return true;
  }

  const allowed = getAllowedAuthOrigins();
  if (allowed.length === 0) return false;

  return allowed.some((base) => {
    try {
      const u = new URL(base);
      const o = new URL(origin);
      return u.protocol === o.protocol && u.host === o.host;
    } catch {
      return false;
    }
  });
}

export function setDataApiCorsHeaders(res: NextResponse, origin: string) {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Credentials", "true");
}

