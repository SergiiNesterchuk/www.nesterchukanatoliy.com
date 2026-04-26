import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // trailingSlash: true ВИДАЛЕНО — ламає WayForPay/KeyCRM POST callbacks
  // (308 redirect губить POST body). SEO canonical вирішується через
  // alternates.canonical в metadata кожної сторінки.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nesterchukanatoliy.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
