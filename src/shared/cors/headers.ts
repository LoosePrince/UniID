import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveOrigin, type CorsPolicyName, type ResolvedOrigin } from "./policy";

const DEFAULT_ALLOWED_METHODS = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
const DEFAULT_ALLOWED_HEADERS = "Authorization,Content-Type,X-App-Id,X-Request-Id,X-UniID-API-Key";
const DEFAULT_MAX_AGE = "600";

export function applyCorsHeaders(res: NextResponse, resolved: ResolvedOrigin): NextResponse {
  res.headers.set("Vary", "Origin");
  if (resolved.allowOrigin) {
    res.headers.set("Access-Control-Allow-Origin", resolved.allowOrigin);
    if (resolved.credentials) {
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }
  res.headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
  res.headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS);
  res.headers.set("Access-Control-Max-Age", DEFAULT_MAX_AGE);
  return res;
}

/**
 * 装饰一个 next 路由 handler，让其：
 * - 自动处理 OPTIONS preflight
 * - 自动在响应头上加 CORS 信息
 * - 若 Origin 被策略拒绝则返回 403 + CORS_ORIGIN_REJECTED
 */
export function withCors(
  policy: CorsPolicyName,
  handler: (req: NextRequest, ctx: { params: Record<string, string | string[]> }) => Promise<Response> | Response
) {
  const wrapped = async (
    req: NextRequest,
    ctx: { params: Record<string, string | string[]> }
  ): Promise<Response> => {
    const resolved = await resolveOrigin(req, policy);

    // preflight
    if (req.method === "OPTIONS") {
      const res = new NextResponse(null, { status: 204 });
      return applyCorsHeaders(res, resolved);
    }

    // 同源/无 Origin 直接放行
    if (!req.headers.get("origin")) {
      const res = await handler(req, ctx);
      return res;
    }

    // 跨域且未通过校验：拒绝
    if (!resolved.allowOrigin) {
      const res = NextResponse.json(
        { error: { code: "CORS_ORIGIN_REJECTED", message: "Origin 不在允许列表中" } },
        { status: 403 }
      );
      return applyCorsHeaders(res, resolved);
    }

    const res = await handler(req, ctx);
    // 把 CORS 头补到响应上（NextResponse 是可变的）
    if (res instanceof NextResponse) {
      applyCorsHeaders(res, resolved);
    } else {
      // 普通 Response：包一层
      const wrappedRes = new NextResponse(res.body, {
        status: res.status,
        headers: res.headers
      });
      return applyCorsHeaders(wrappedRes, resolved);
    }
    return res;
  };
  return wrapped;
}
