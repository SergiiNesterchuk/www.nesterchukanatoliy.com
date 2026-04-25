import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // www → non-www 301 redirect (SEO canonical)
  if (host.startsWith("www.")) {
    const newUrl = new URL(request.url);
    newUrl.hostname = host.replace(/^www\./, "");
    return NextResponse.redirect(newUrl, 301);
  }

  const { pathname } = request.nextUrl;

  // Admin auth check
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // www redirect — всі сторінки крім static/_next/api
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
    // Admin auth
    "/admin/:path*",
  ],
};
