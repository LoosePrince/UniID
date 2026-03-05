import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "./prisma";

// 登录有效期：7 天（Access Token）
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
// Refresh Token 默认有效期：7 天（保持不变，主要用于换发）
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

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
    .setSubject(String(payload.sub))
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
    .setSubject(String(payload.sub))
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

  // 获取 Token 中的 app_id
  const tokenAppId = payload.app_id;

  // 如果提供了 app_id 参数，优先使用提供的 app_id 进行验证
  // 否则使用 Token 中的 app_id
  const appIdToValidate = providedAppId || tokenAppId;

  if (!appIdToValidate) {
    return { valid: false, error: "APP_ID_REQUIRED" };
  }

  try {
    // 1. 校验 app 配置与 Origin 是否匹配（如果提供了 Origin，且不是本地开发）
    if (origin) {
      const isDev = process.env.NODE_ENV !== "production";
      let skipDomainCheck = false;

      // 简单解析 origin 中的 hostname（例如 https://example.com:3000/path）
      const strippedOrigin = origin.replace(/^[a-zA-Z]+:\/\//, "");
      const originHost = strippedOrigin.split("/")[0]; // host[:port]
      const originHostname = originHost.split(":")[0];

      if (isDev) {
        if (
          originHostname === "localhost" ||
          originHostname === "127.0.0.1" ||
          originHostname === "::1"
        ) {
          skipDomainCheck = true;
        }
      }

      if (!skipDomainCheck) {
        // 查询 app_id 对应的域名
        const app = await prisma.app.findUnique({
          where: { id: appIdToValidate }
        });

        if (!app) {
          return { valid: false, error: "APP_NOT_FOUND" };
        }

        if (app.domain !== originHost) {
          return {
            valid: false,
            error: `APP_ID_ORIGIN_MISMATCH: app_id ${appIdToValidate} is registered to domain ${app.domain}, but request comes from ${originHost}`
          };
        }
      }
    }

    // 2. 校验授权记录是否仍然有效（实现“真取消”）
    const now = Math.floor(Date.now() / 1000);
    const userId = payload.sub;

    const authorization = await prisma.authorization.findUnique({
      where: {
        userId_appId: {
          userId,
          appId: appIdToValidate
        }
      }
    });

    if (!authorization) {
      return { valid: false, error: "AUTHORIZATION_NOT_FOUND" };
    }

    if (authorization.revoked === 1) {
      return { valid: false, error: "AUTHORIZATION_REVOKED" };
    }

    if (authorization.expiresAt != null && authorization.expiresAt <= now) {
      return { valid: false, error: "AUTHORIZATION_EXPIRED" };
    }

    return { valid: true, payload };
  } catch (err) {
    console.error("[verifyTokenWithAppIdCheck] Error:", err);
    return { valid: false, error: "VALIDATION_ERROR" };
  }
}

