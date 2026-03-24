import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

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

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function resolveAllowedAuthOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && isLocalOrigin(origin)) {
    return origin;
  }

  const allowed = getAllowedAuthOrigins();
  if (allowed.length === 0) return null;

  for (const base of allowed) {
    try {
      const allowedUrl = new URL(base);
      const originUrl = new URL(origin);
      if (
        allowedUrl.protocol === originUrl.protocol &&
        allowedUrl.host === originUrl.host
      ) {
        return origin;
      }
    } catch {
      // Ignore invalid URL and continue checking.
    }
  }

  return null;
}

export function isSameOriginAuthRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // 非浏览器跨域 XHR（如 curl / 服务器内部调用），允许通过
    return true;
  }

  return resolveAllowedAuthOrigin(origin) !== null;
}

export function setAuthCorsHeaders(res: NextResponse, origin: string): void {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Credentials", "true");
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

export async function validateAppIdOriginMatchWithOrigin(
  appId: string,
  origin: string
): Promise<{ valid: boolean; error?: string }> {
  // 开发环境本地请求跳过验证
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"
      ) {
        return { valid: true };
      }
    } catch {
      // 解析失败继续验证
    }
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;

    // 查询 app_id 对应的域名
    const app = await prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      return { valid: false, error: "APP_NOT_FOUND" };
    }

    // 比较域名是否匹配
    if (app.domain !== originHost) {
      return {
        valid: false,
        error: `APP_ID_ORIGIN_MISMATCH: app_id ${appId} is registered to domain ${app.domain}, but request comes from ${originHost}`
      };
    }

    return { valid: true };
  } catch (err) {
    console.error("[validateAppIdOriginMatchWithOrigin] Error:", err);
    return { valid: false, error: "VALIDATION_ERROR" };
  }
}

/**
 * 验证请求的 app_id 与 Origin 是否匹配
 * 防止不同域名使用同一个 app_id 进行非法请求
 */
export async function validateAppIdOriginMatch(
  req: NextRequest,
  appId: string
): Promise<{ valid: boolean; error?: string }> {
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");

  // 如果没有 Origin 头（如同域请求或非浏览器请求），跳过验证
  if (!origin) {
    return { valid: true };
  }

  return validateAppIdOriginMatchWithOrigin(appId, origin);
}

