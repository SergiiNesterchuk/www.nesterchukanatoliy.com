import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";

/**
 * Dynamic favicon proxy — serves favicon content directly.
 * Browsers handle proxied content better than redirects for favicons.
 */
export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: "site_favicon_url" },
    });

    if (setting?.value) {
      const res = await fetch(setting.value);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/png";
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      }
    }
  } catch { /* fallback */ }

  // Fallback: serve default favicon.ico
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const buf = await fs.readFile(path.join(process.cwd(), "public", "favicon.ico"));
    return new NextResponse(buf, {
      headers: { "Content-Type": "image/x-icon", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
