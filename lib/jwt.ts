import { SignJWT, jwtVerify, type JWTPayload } from "jose";

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

