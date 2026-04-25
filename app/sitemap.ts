import type { MetadataRoute } from "next";
import { prisma } from "@/shared/db";
import { SITE_URL } from "@/shared/constants";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;

  let products: { slug: string }[] = [];
  let categories: { slug: string }[] = [];
  let pages: { slug: string }[] = [];

  try {
    [products, categories, pages] = await Promise.all([
      prisma.product.findMany({ where: { isActive: true }, select: { slug: true } }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
      prisma.page.findMany({ where: { isActive: true }, select: { slug: true } }),
    ]);
  } catch { /* БД недоступна при build — повернути мінімальний sitemap */ }

  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/katalog/`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({
      url: `${base}/${c.slug}/`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/${p.slug}/`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...pages.map((p) => ({
      url: `${base}/${p.slug}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
