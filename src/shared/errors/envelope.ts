import { NextResponse } from "next/server";
import type { SupportedLocale } from "@/shared/i18n/config";
import { resolveErrorMessage } from "@/shared/i18n/core";
import { ErrorCodes, type ErrorCode } from "./codes";

export interface ErrorEnvelopeBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * 受控异常类。所有业务错误抛出 ApiError，由 defineRoute / withErrorBoundary 统一捕获。
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly httpStatus: number;
  readonly customMessage?: string;

  constructor(code: ErrorCode, opts?: { message?: string; details?: unknown }) {
    const meta = ErrorCodes[code];
    super(opts?.message ?? meta.message);
    this.name = "ApiError";
    this.code = code;
    this.details = opts?.details;
    this.httpStatus = meta.http;
    this.customMessage = opts?.message;
  }
}

export function errorEnvelope(
  code: ErrorCode,
  opts?: { message?: string; details?: unknown; requestId?: string; locale?: SupportedLocale }
): ErrorEnvelopeBody {
  const message = opts?.locale
    ? resolveErrorMessage(opts.locale, code, opts.message)
    : (opts?.message ?? ErrorCodes[code].message);
  return {
    error: {
      code,
      message,
      details: opts?.details,
      requestId: opts?.requestId
    }
  };
}

export function errorResponse(
  err: ApiError,
  requestId?: string,
  headers?: HeadersInit,
  locale?: SupportedLocale
): NextResponse<ErrorEnvelopeBody> {
  return NextResponse.json(
    errorEnvelope(err.code, {
      message: locale ? resolveErrorMessage(locale, err.code, err.customMessage) : err.message,
      details: err.details,
      requestId,
      locale
    }),
    { status: err.httpStatus, headers }
  );
}
