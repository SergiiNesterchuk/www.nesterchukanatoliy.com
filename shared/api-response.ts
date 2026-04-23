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
    // Build human-readable validation message
    const fieldErrors = error.issues.map((i) => {
      const field = i.path.join(".");
      return field ? `${field}: ${i.message}` : i.message;
    });
    const message = fieldErrors.length > 0
      ? `Помилка валідації: ${fieldErrors.slice(0, 3).join("; ")}`
      : "Невірні дані";

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message,
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
