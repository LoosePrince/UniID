import { NextResponse } from "next/server";
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

  constructor(code: ErrorCode, opts?: { message?: string; details?: unknown }) {
    const meta = ErrorCodes[code];
    super(opts?.message ?? meta.message);
    this.name = "ApiError";
    this.code = code;
    this.details = opts?.details;
    this.httpStatus = meta.http;
  }
}

export function errorEnvelope(
  code: ErrorCode,
  opts?: { message?: string; details?: unknown; requestId?: string }
): ErrorEnvelopeBody {
  const meta = ErrorCodes[code];
  return {
    error: {
      code,
      message: opts?.message ?? meta.message,
      details: opts?.details,
      requestId: opts?.requestId
    }
  };
}

export function errorResponse(
  err: ApiError,
  requestId?: string,
  headers?: HeadersInit
): NextResponse<ErrorEnvelopeBody> {
  return NextResponse.json(
    errorEnvelope(err.code, { message: err.message, details: err.details, requestId }),
    { status: err.httpStatus, headers }
  );
}
