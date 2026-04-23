import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { ZodError } from "zod";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    total?: number;
    page?: number;
    pages?: number;
    limit?: number;
  };
}

export function successResponse<T>(data: T, meta?: ApiResponse<T>["meta"], status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data, meta }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: { issues: error.issues as unknown as Record<string, unknown> },
        },
      },
      { status: 400 }
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    },
    { status: 500 }
  );
}
