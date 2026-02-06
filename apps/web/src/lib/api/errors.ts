import { NextResponse } from "next/server";

export const ApiErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

const STATUS_MAP: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

const MESSAGE_MAP: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation failed",
  CONFLICT: "Resource conflict",
  NOT_IMPLEMENTED: "Not implemented",
  INTERNAL_ERROR: "Internal server error",
};

export function apiError(code: ApiErrorCode, details?: unknown): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message: MESSAGE_MAP[code],
        ...(details !== undefined && { details }),
      },
    },
    { status: STATUS_MAP[code] },
  );
}
