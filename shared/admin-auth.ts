import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return !!token;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function adminGuard<T extends (...args: any[]) => Promise<NextResponse>>(handler: T): T {
  const wrapped = async (...args: any[]) => {
    const req = args[0] as NextRequest;
    const token = req.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }
    return handler(...args);
  };
  return wrapped as unknown as T;
}
