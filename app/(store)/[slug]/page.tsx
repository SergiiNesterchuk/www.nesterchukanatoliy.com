import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryRepository } from "@/repositories/CategoryRepository";
import { ProductRepository } from "@/repositories/ProductRepository";
import { PageRepository } from "@/repositories/PageRepository";
import { ProductService } from "@/services/ProductService";
import { CategoryService } from "@/services/CategoryService";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { SortingSelect } from "@/components/catalog/SortingSelect";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductInfo } from "@/components/catalog/ProductInfo";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildItemListJsonLd,
} from "@/shared/seo";
import { SITE_URL } from "@/shared/constants";
import type { SortOption } from "@/shared/constants";

export const dynamic = "force-dynamic";

type SlugEntity =
  | { type: "category"; slug: string }
  | { type: "product"; slug: string }
  | { type: "page"; slug: string }
  | null;

async function resolveSlug(slug: string): Promise<SlugEntity> {
  try {
    // Check category first
    const category = await CategoryRepository.findBySlug(slug);
    if (category) return { type: "category", slug };

    // Check product
    const product = await ProductRepository.findBySlug(slug);
    if (product) return { type: "product", slug };

    // Check page
    const page = await PageRepository.findBySlug(slug);
    if (page) return { type: "page", slug };
  } catch (error) {
    console.error("Slug resolution failed:", slug, error instanceof Error ? error.message : error);
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = await resolveSlug(slug);

  if (!entity) return {};

  if (entity.type === "category") {
    const category = await CategoryService.getBySlug(slug);
    return {
      title: category.metaTitle || category.name,
      description: category.metaDesc || category.description || undefined,
      alternates: { canonical: `/${slug}/` },
    };
  }

  if (entity.type === "product") {
    const product = await ProductService.getBySlug(slug);
    return {
      title: product.metaTitle || product.name,
      description: product.metaDesc || product.shortDescription || undefined,
      alternates: { canonical: `/${slug}/` },
      openGraph: {
        title: product.metaTitle || product.name,
        description: product.metaDesc || product.shortDescription || undefined,
        images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
        type: "website",
      },
    };
  }

  if (entity.type === "page") {
    const page = await PageRepository.findBySlug(slug);
    if (!page) return {};
    return {
      title: page.metaTitle || page.title,
      description: page.metaDesc || undefined,
      alternates: { canonical: `/${slug}/` },
    };
  }

  return {};
}

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];

  try {
    const [categories, products, pages] = await Promise.all([
      CategoryRepository.findAllSlugs(),
      ProductRepository.findAllSlugs(),
      PageRepository.findAll(),
    ]);

    return [
      ...categories.map((c) => ({ slug: c.slug })),
      ...products.map((p) => ({ slug: p.slug })),
      ...pages.map((p) => ({ slug: p.slug })),
    ];
  } catch {
    return [];
  }
}

export default async function SlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { slug } = await params;
  const entity = await resolveSlug(slug);

  if (!entity) {
    // Check redirects before 404
    try {
      const { prisma } = await import("@/shared/db");
      const redirect = await prisma.redirect.findFirst({
        where: { fromPath: `/${slug}`, isActive: true },
      });
      if (redirect) {
        const { redirect: nextRedirect } = await import("next/navigation");
        nextRedirect(redirect.toPath);
      }
    } catch { /* */ }
    notFound();
  }

  if (entity.type === "category") {
    return <CategoryView slug={slug} searchParams={await searchParams} />;
  }

  if (entity.type === "product") {
    return <ProductView slug={slug} />;
  }

  if (entity.type === "page") {
    return <PageView slug={slug} />;
  }

  notFound();
}

// --- Category view ---
async function CategoryView({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: { sort?: string; page?: string };
}) {
  const category = await CategoryService.getBySlug(slug);
  const sort = (searchParams.sort || "popularity") as SortOption;
  const page = parseInt(searchParams.page || "1", 10);
  const { items: products } = await ProductService.getList({
    categorySlug: slug,
    sort,
    page,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Головна", url: SITE_URL },
          { name: category.name, url: `${SITE_URL}/${slug}/` },
        ])}
      />
      <JsonLd
        data={buildItemListJsonLd(
          products.map((p) => ({ name: p.name, url: `${SITE_URL}/${p.slug}/` }))
        )}
      />

      <Breadcrumbs items={[{ label: category.name }]} />

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {category.name}
        </h1>
        <Suspense>
          <SortingSelect />
        </Suspense>
      </div>

      {category.description && (
        <p className="mt-2 text-gray-600 max-w-3xl">{category.description}</p>
      )}

      <div className="mt-6">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}

// --- Product view ---
async function ProductView({ slug }: { slug: string }) {
  const product = await ProductService.getBySlug(slug);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Головна", url: SITE_URL },
          {
            name: product.category.name,
            url: `${SITE_URL}/${product.category.slug}/`,
          },
          { name: product.name, url: `${SITE_URL}/${product.slug}/` },
        ])}
      />
      <JsonLd data={buildProductJsonLd(product)} />

      <Breadcrumbs
        items={[
          { label: product.category.name, href: `/${product.category.slug}/` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />
        <ProductInfo product={product} />
      </div>

      <div className="mt-10">
        <ProductTabs description={product.description} />
      </div>

      <ProductReviews productId={product.id} />
    </div>
  );
}

// --- Page view ---
async function PageView({ slug }: { slug: string }) {
  const page = await PageRepository.findBySlug(slug);
  if (!page) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Головна", url: SITE_URL },
          { name: page.title, url: `${SITE_URL}/${slug}/` },
        ])}
      />
      <Breadcrumbs items={[{ label: page.title }]} />

      <div
        className="mt-6 prose prose-sm md:prose-base max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </div>
  );
}
