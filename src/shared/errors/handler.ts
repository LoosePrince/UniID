import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { localizeMessage } from "@/shared/i18n/core";
import { resolveRequestLocale } from "@/shared/i18n/server";
import type { SupportedLocale } from "@/shared/i18n/config";
import { ApiError, errorResponse, errorEnvelope } from "./envelope";
import { logger } from "../logger";

/**
 * 把任意异常转成统一 envelope NextResponse。
 * - ApiError 直通对应 http code
 * - ZodError 折叠为 VALIDATION_FAILED 400
 * - 其它视为 INTERNAL_ERROR 500，并在日志里打全栈
 */
export async function toErrorResponse(
  err: unknown,
  requestId?: string,
  req?: NextRequest
): Promise<NextResponse> {
  const locale = req ? await resolveRequestLocale(req) : undefined;
  if (err instanceof ApiError) {
    return errorResponse(err, requestId, undefined, locale);
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_FAILED", {
        details: localizeZodIssues(locale, err),
        requestId,
        locale
      }),
      { status: 400 }
    );
  }
  logger.error({ err, requestId }, "unhandled route error");
  return NextResponse.json(
    errorEnvelope("INTERNAL_ERROR", { requestId, locale }),
    { status: 500 }
  );
}

function localizeZodIssues(locale: SupportedLocale | undefined, err: ZodError) {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: locale ? localizeMessage(locale, issue.message) : issue.message
  }));
}
