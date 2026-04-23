import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/shared/db";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse(new Error("Email and password required"));
    }

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FAILED", message: "Невірні дані" } },
        { status: 401 }
      );
    }

    const hash = createHash("sha256").update(password).digest("hex");
    if (hash !== user.passwordHash) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_FAILED", message: "Невірні дані" } },
        { status: 401 }
      );
    }

    // Set admin cookie
    const token = createHash("sha256")
      .update(`${user.id}-${Date.now()}-${process.env.ADMIN_JWT_SECRET}`)
      .digest("hex");

    const response = successResponse({ name: user.name, email: user.email });
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
