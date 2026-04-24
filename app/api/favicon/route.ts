import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";

/**
 * Dynamic favicon redirect.
 * Reads site_favicon_url from Settings and redirects to R2 image.
 * Falls back to /favicon.ico static file.
 */
export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: "site_favicon_url" },
    });

    if (setting?.value) {
      return NextResponse.redirect(setting.value, 302);
    }
  } catch { /* fallback */ }

  // Fallback to default favicon
  return NextResponse.redirect(new URL("/favicon.ico", process.env.SITE_URL || "https://nesterchukanatoliy.com"), 302);
}
