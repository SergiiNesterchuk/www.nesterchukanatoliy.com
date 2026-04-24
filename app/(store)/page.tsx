import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProductService } from "@/services/ProductService";
import { CategoryService } from "@/services/CategoryService";
import { PageRepository } from "@/repositories/PageRepository";
import { buildWebSiteJsonLd, buildOrganizationJsonLd } from "@/shared/seo";
import { SITE_NAME, SITE_DESCRIPTION } from "@/shared/constants";
import { sanitizeHtml } from "@/shared/sanitize-html";
import { prisma } from "@/shared/db";

export const metadata: Metadata = {
  title: `${SITE_NAME} — натуральний яблучний оцет та бордоська суміш`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

async function getHomeConfig() {
  const defaults: Record<string, string> = {
    homepage_title: "Натуральні продукти",
    homepage_title_accent: "власного виробництва",
    homepage_description: "Яблучний оцет без хімії та штучних добавок. Бордоська суміш для захисту саду. Якщо я рекомендую — значить я цим користуюся сам.",
    homepage_cta_text: "Перейти до каталогу",
    homepage_cta_link: "/katalog/",
    homepage_products_title: "Наші товари",
    homepage_categories_title: "Категорії",
    homepage_show_categories: "true",
    homepage_show_hero: "true",
    homepage_show_products: "true",
    homepage_show_pages: "false",
    homepage_content_block: "",
    homepage_content_block_position: "after_hero",
  };

  try {
    const settings = await prisma.settings.findMany({
      where: { key: { startsWith: "homepage_" } },
    });
    for (const s of settings) {
      if (s.value !== null && s.value !== undefined) defaults[s.key] = s.value;
    }
  } catch { /* */ }

  return defaults;
}

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof ProductService.getAll>> = [];
  let categories: Awaited<ReturnType<typeof CategoryService.getAll>> = [];
  let homePages: { id: string; title: string; slug: string }[] = [];

  try {
    [products, categories, homePages] = await Promise.all([
      ProductService.getAll(),
      CategoryService.getAll(),
      PageRepository.findForHome(),
    ]);
  } catch (error) {
    console.error("Homepage data fetch failed:", error instanceof Error ? error.message : error);
  }

  const hp = await getHomeConfig();
  const showHero = hp.homepage_show_hero !== "false";
  const showCategories = hp.homepage_show_categories !== "false";
  const showProducts = hp.homepage_show_products !== "false";
  const showPages = hp.homepage_show_pages !== "false";
  const contentBlock = hp.homepage_content_block ? sanitizeHtml(hp.homepage_content_block) : "";
  let contentPosition = hp.homepage_content_block_position || "after_hero";
  // If hero is off and content was "after_hero", show it as first block
  if (!showHero && contentPosition === "after_hero") contentPosition = "top";

  return (
    <>
      <JsonLd data={buildWebSiteJsonLd()} />
      <JsonLd data={buildOrganizationJsonLd()} />

      {/* Content block — top position (when hero is off) */}
      {contentBlock && contentPosition === "top" && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="prose prose-sm md:prose-base max-w-none" dangerouslySetInnerHTML={{ __html: contentBlock }} />
        </section>
      )}

      {/* Hero */}
      {showHero && (
        <section className="bg-gradient-to-br from-green-50 to-green-100">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                {hp.homepage_title}
                <span className="text-green-600"> {hp.homepage_title_accent}</span>
              </h1>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                {hp.homepage_description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={hp.homepage_cta_link}
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {hp.homepage_cta_text}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Content block — after hero */}
      {contentBlock && contentPosition === "after_hero" && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div
            className="prose prose-sm md:prose-base max-w-none"
            dangerouslySetInnerHTML={{ __html: contentBlock }}
          />
        </section>
      )}

      {/* Categories block — controlled by admin setting */}
      {showCategories && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{hp.homepage_categories_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/${cat.slug}/`}
                className="group relative bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">{cat.description}</p>
                )}
                <span className="mt-3 inline-block text-sm text-green-600 font-medium">
                  {cat.productCount} {cat.productCount === 1 ? "товар" : "товарів"} &rarr;
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Content block — after categories */}
      {contentBlock && contentPosition === "after_categories" && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div
            className="prose prose-sm md:prose-base max-w-none"
            dangerouslySetInnerHTML={{ __html: contentBlock }}
          />
        </section>
      )}

      {/* Products */}
      {showProducts && products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{hp.homepage_products_title}</h2>
          <ProductGrid products={products} />
        </section>
      )}

      {/* Content block — after products */}
      {contentBlock && contentPosition === "after_products" && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div
            className="prose prose-sm md:prose-base max-w-none"
            dangerouslySetInnerHTML={{ __html: contentBlock }}
          />
        </section>
      )}

      {/* Selected pages */}
      {showPages && homePages.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {homePages.map((page) => (
              <Link
                key={page.id}
                href={`/${page.slug}/`}
                className="group bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  {page.title}
                </h3>
                <span className="mt-2 inline-block text-sm text-green-600">Детальніше &rarr;</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
