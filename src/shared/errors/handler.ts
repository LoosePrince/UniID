import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, errorResponse, errorEnvelope } from "./envelope";
import { logger } from "../logger";

/**
 * 把任意异常转成统一 envelope NextResponse。
 * - ApiError 直通对应 http code
 * - ZodError 折叠为 VALIDATION_FAILED 400
 * - 其它视为 INTERNAL_ERROR 500，并在日志里打全栈
 */
export function toErrorResponse(err: unknown, requestId?: string): NextResponse {
  if (err instanceof ApiError) {
    return errorResponse(err, requestId);
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_FAILED", {
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          code: i.code,
          message: i.message
        })),
        requestId
      }),
      { status: 400 }
    );
  }
  logger.error({ err, requestId }, "unhandled route error");
  return NextResponse.json(
    errorEnvelope("INTERNAL_ERROR", { requestId }),
    { status: 500 }
  );
}
