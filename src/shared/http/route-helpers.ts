import { NextRequest, NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";
import { randomUUID } from "node:crypto";
import { ApiError, toErrorResponse } from "../errors";
import { childLogger } from "../logger";

export type RouteContext<TParams = Record<string, string>> = {
  req: NextRequest;
  requestId: string;
  params: TParams;
  log: ReturnType<typeof childLogger>;
};

type SchemaShape = {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
};

type Parsed<S extends SchemaShape> = {
  params: S["params"] extends ZodTypeAny ? z.infer<S["params"]> : undefined;
  query: S["query"] extends ZodTypeAny ? z.infer<S["query"]> : undefined;
  body: S["body"] extends ZodTypeAny ? z.infer<S["body"]> : undefined;
};

export type NextRouteHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string | string[]> }
) => Promise<Response> | Response;

export interface DefineRouteOptions<S extends SchemaShape, TResponse> {
  schema?: S;
  /**
   * 业务处理函数：可返回纯 JSON 数据（自动包成 200），或返回完整 NextResponse。
   * 抛 ApiError / ZodError 会被自动转 envelope。
   */
  handler: (
    input: Parsed<S>,
    ctx: RouteContext
  ) => Promise<TResponse | NextResponse> | TResponse | NextResponse;
}

/**
 * 把一个声明式路由定义编译成 next.js 路由处理函数。
 *
 * - 自动生成 requestId 并写入响应头 `x-request-id`
 * - 自动 zod 校验 params / query / body
 * - 任意异常都被转成统一 envelope
 * - 日志附带 requestId / method / path
 */
export function defineRoute<S extends SchemaShape, TResponse>(
  opts: DefineRouteOptions<S, TResponse>
): NextRouteHandler {
  return async (req, ctx) => {
    const requestId =
      req.headers.get("x-request-id") ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : randomUUID());

    const log = childLogger({
      requestId,
      method: req.method,
      path: req.nextUrl.pathname
    });

    try {
      const rawParams = (await Promise.resolve(ctx.params)) ?? {};
      const params = opts.schema?.params
        ? opts.schema.params.parse(rawParams)
        : (rawParams as unknown);

      const query = opts.schema?.query
        ? opts.schema.query.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
        : undefined;

      let body: unknown = undefined;
      if (opts.schema?.body) {
        const contentType = req.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          try {
            body = await req.json();
          } catch {
            body = {};
          }
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const formData = await req.formData();
          body = Object.fromEntries(formData.entries());
        } else {
          body = undefined;
        }
        body = opts.schema.body.parse(body);
      }

      const result = await opts.handler(
        { params, query, body } as Parsed<S>,
        { req, requestId, params: params as Record<string, string>, log }
      );

      if (result instanceof NextResponse) {
        result.headers.set("x-request-id", requestId);
        return result;
      }

      const res = jsonResponse(result as unknown, { status: 200 });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      const res = toErrorResponse(err, requestId);
      res.headers.set("x-request-id", requestId);
      if (!(err instanceof ApiError)) {
        log.error({ err }, "route handler crashed");
      } else {
        log.warn({ code: err.code, status: err.httpStatus }, err.message);
      }
      return res;
    }
  };
}

/**
 * BigInt-safe JSON 响应。Prisma 的 BigInt 字段（如 Quota.monthlyStorageBytes）
 * 默认 JSON.stringify 会抛错；这里在序列化时把 BigInt 转为 number。
 * SQLite 实际配额值远 < 2^53，转 number 不丢精度；超过则降级为 string。
 */
function bigintSafeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= -BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  return value;
}

export function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
  const body = JSON.stringify(data, bigintSafeReplacer);
  return new NextResponse(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

/**
 * 便捷：对一个 handler 强制要求 JSON 响应（带类型）。
 */
export function json<T>(data: T, init?: ResponseInit) {
  return jsonResponse(data, init);
}
