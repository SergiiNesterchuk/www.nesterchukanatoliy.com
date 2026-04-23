import { NextResponse } from "next/server";
import { ProductRepository } from "@/repositories/ProductRepository";
import { CategoryRepository } from "@/repositories/CategoryRepository";
import { PageRepository } from "@/repositories/PageRepository";
import { SITE_URL } from "@/shared/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const [products, categories, pages] = await Promise.all([
    ProductRepository.findAllSlugs(),
    CategoryRepository.findAllSlugs(),
    PageRepository.findAll(),
  ]);

  const now = new Date().toISOString().split("T")[0];

  const urls = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/katalog/", priority: "0.9", changefreq: "daily" },
    ...categories.map((c) => ({
      loc: `/${c.slug}/`,
      priority: "0.8",
      changefreq: "daily" as const,
    })),
    ...products.map((p) => ({
      loc: `/${p.slug}/`,
      priority: "0.7",
      changefreq: "weekly" as const,
    })),
    ...pages.map((p) => ({
      loc: `/${p.slug}/`,
      priority: "0.5",
      changefreq: "monthly" as const,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
