import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "./prisma";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  username: string;
  role: string;
  app_id?: string;
  auth_type?: "full" | "restricted";
};

export async function signAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">) {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    ...payload,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .sign(secret);
}

export async function signRefreshToken(payload: { sub: string }) {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: payload.sub,
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SECONDS
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .sign(secret);
}

export async function verifyToken<T extends JWTPayload = AccessTokenPayload>(token: string) {
  const secret = getSecret();
  const { payload } = await jwtVerify<T>(token, secret);
  return payload;
}

/**
 * 验证 Token 并检查 app_id 与请求域名是否匹配
 * 确保 Token 不能跨域使用
 */
export async function verifyTokenWithAppIdCheck(
  token: string,
  origin: string | null,
  providedAppId?: string
): Promise<{ valid: boolean; payload?: AccessTokenPayload; error?: string }> {
  let payload: AccessTokenPayload;
  
  try {
    payload = await verifyToken(token);
  } catch (err) {
    return { valid: false, error: "INVALID_TOKEN" };
  }

  if (!payload.sub) {
    return { valid: false, error: "NO_SUBJECT" };
  }

  // 如果没有 origin（如同域请求或非浏览器请求），跳过 domain 验证
  if (!origin) {
    return { valid: true, payload };
  }

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
        return { valid: true, payload };
      }
    } catch {
      // 解析失败继续验证
    }
  }

  // 获取 Token 中的 app_id
  const tokenAppId = payload.app_id;
  
  // 如果提供了 app_id 参数，优先使用提供的 app_id 进行验证
  // 否则使用 Token 中的 app_id
  const appIdToValidate = providedAppId || tokenAppId;
  
  if (!appIdToValidate) {
    return { valid: false, error: "APP_ID_REQUIRED" };
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;

    // 查询 app_id 对应的域名
    const app = await prisma.app.findUnique({
      where: { id: appIdToValidate }
    });

    if (!app) {
      return { valid: false, error: "APP_NOT_FOUND" };
    }

    // 比较域名是否匹配
    if (app.domain !== originHost) {
      return {
        valid: false,
        error: `APP_ID_ORIGIN_MISMATCH: app_id ${appIdToValidate} is registered to domain ${app.domain}, but request comes from ${originHost}`
      };
    }

    return { valid: true, payload };
  } catch (err) {
    console.error("[verifyTokenWithAppIdCheck] Error:", err);
    return { valid: false, error: "VALIDATION_ERROR" };
  }
}

