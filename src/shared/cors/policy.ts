import type { NextRequest } from "next/server";
import { prisma } from "@/shared/prisma";
import { config } from "@/shared/config";

/**
 * 命名 CORS 策略。每条路由声明一种策略，由 withCors 解析后产生 Allow-Origin 头。
 */
export type CorsPolicyName =
  | "admin-only" // UniID 自身 / ADMIN_ALLOWED_ORIGINS
  | "app-domain" // 已注册 app.domain（含 AppDomain 副域名）
  | "app-or-admin" // app-domain ∪ admin-only
  | "public"; // 任意 Origin，无凭证

export interface ResolvedOrigin {
  /** 返回 null 表示拒绝（CORS 头不返回 Allow-Origin）。 */
  allowOrigin: string | null;
  /** 是否允许凭证（cookie）。public 策略下应为 false。 */
  credentials: boolean;
}

function isLocalDevOrigin(origin: string): boolean {
  if (config().NODE_ENV === "production") return false;
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
  } catch {
    return false;
  }
}

function matchAdminOrigin(origin: string): boolean {
  const allowed = config().adminAllowedOrigins;
  return allowed.some((base) => {
    try {
      const a = new URL(base);
      const o = new URL(origin);
      return a.protocol === o.protocol && a.host === o.host;
    } catch {
      return false;
    }
  });
}

async function matchAppDomainFromRequest(req: NextRequest, originHost: string): Promise<boolean> {
  // 优先用 query/header 中的 app_id 直接查；找不到再退到 host 反查
  const appIdFromQuery = req.nextUrl.searchParams.get("app_id");
  const appIdFromHeader = req.headers.get("x-app-id");
  const appId = appIdFromQuery ?? appIdFromHeader;

  if (appId) {
    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: { domains: true }
    });
    if (!app) return false;
    if (app.primaryDomain === originHost) return true;
    return app.domains.some((d) => d.verified === 1 && d.host === originHost);
  }

  // 直接以 host 反查（适合 /api/v1/data/[appId]/... 这种路径里带 appId 的情况，
  // path 参数我们交给具体 handler 校验，这里更宽松——只要 host 命中任意一个已验证域名即可）
  const domain = await prisma.appDomain.findFirst({
    where: { host: originHost, verified: 1 }
  });
  if (domain) return true;

  const primary = await prisma.app.findFirst({ where: { primaryDomain: originHost } });
  return Boolean(primary);
}

export async function resolveOrigin(
  req: NextRequest,
  policy: CorsPolicyName
): Promise<ResolvedOrigin> {
  const origin = req.headers.get("origin");
  if (!origin) {
    // 非浏览器/同源请求，不需要 CORS。
    return { allowOrigin: null, credentials: false };
  }

  if (isLocalDevOrigin(origin)) {
    return { allowOrigin: origin, credentials: policy !== "public" };
  }

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return { allowOrigin: null, credentials: false };
  }

  switch (policy) {
    case "public":
      return { allowOrigin: origin, credentials: false };
    case "admin-only":
      return matchAdminOrigin(origin)
        ? { allowOrigin: origin, credentials: true }
        : { allowOrigin: null, credentials: false };
    case "app-domain":
      return (await matchAppDomainFromRequest(req, host))
        ? { allowOrigin: origin, credentials: true }
        : { allowOrigin: null, credentials: false };
    case "app-or-admin":
      if (matchAdminOrigin(origin)) return { allowOrigin: origin, credentials: true };
      return (await matchAppDomainFromRequest(req, host))
        ? { allowOrigin: origin, credentials: true }
        : { allowOrigin: null, credentials: false };
  }
}
