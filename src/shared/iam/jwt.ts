import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config";
import { ApiError } from "../errors";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15; // 15 分钟
export const SESSION_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

let secretCache: Uint8Array | undefined;
function getSecret(): Uint8Array {
  if (secretCache) return secretCache;
  secretCache = new TextEncoder().encode(config().AUTH_JWT_SECRET);
  return secretCache;
}

export interface AppAccessTokenPayload extends JWTPayload {
  sub: string; // user id
  sid: string; // AppSession id
  app_id: string;
  auth_type: "full" | "restricted";
  role: string;
  username: string;
}

export interface UserSessionTokenPayload extends JWTPayload {
  sub: string;
  sid: string;
  role: string;
  username: string;
  csrf: string;
}

export async function signAppAccessToken(
  payload: Omit<AppAccessTokenPayload, "iat" | "exp" | "iss" | "aud">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const sub = String(payload.sub);
  const aud = String(payload.app_id);
  return new SignJWT({ ...payload, iat: now, exp: now + ACCESS_TOKEN_TTL_SECONDS })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuedAt(now)
    .setIssuer("uniid")
    .setAudience(aud)
    .sign(getSecret());
}

export async function verifyAppAccessToken(token: string): Promise<AppAccessTokenPayload> {
  try {
    const { payload } = await jwtVerify<AppAccessTokenPayload>(token, getSecret(), {
      issuer: "uniid"
    });
    if (!payload.sub || !payload.sid || !payload.app_id) {
      throw new ApiError("AUTH_INVALID_TOKEN");
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("AUTH_INVALID_TOKEN");
  }
}

export async function signUserSessionToken(
  payload: Omit<UserSessionTokenPayload, "iat" | "exp">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const sub = String(payload.sub);
  return new SignJWT({ ...payload, iat: now, exp: now + SESSION_COOKIE_TTL_SECONDS })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuedAt(now)
    .setIssuer("uniid")
    .setAudience("uniid-console")
    .sign(getSecret());
}

export async function verifyUserSessionToken(token: string): Promise<UserSessionTokenPayload> {
  try {
    const { payload } = await jwtVerify<UserSessionTokenPayload>(token, getSecret(), {
      issuer: "uniid",
      audience: "uniid-console"
    });
    if (!payload.sub || !payload.sid) throw new ApiError("AUTH_INVALID_TOKEN");
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("AUTH_INVALID_TOKEN");
  }
}
