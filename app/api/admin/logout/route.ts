import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(new URL("/admin/login", process.env.SITE_URL || "https://nesterchukanatoliy.com"));
  response.cookies.set("admin_token", "", { maxAge: 0, path: "/" });
  return response;
}
