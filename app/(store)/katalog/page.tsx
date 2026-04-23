import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { SortingSelect } from "@/components/catalog/SortingSelect";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProductService } from "@/services/ProductService";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/shared/seo";
import { SITE_URL } from "@/shared/constants";
import type { SortOption } from "@/shared/constants";

export const metadata: Metadata = {
  title: "Каталог товарів",
  description:
    "Каталог натуральних продуктів: яблучний оцет, бордоська суміш. Замовляйте з доставкою по Україні.",
  alternates: { canonical: "/katalog/" },
};

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort = (params.sort || "popularity") as SortOption;
  const page = parseInt(params.page || "1", 10);

  const { items: products } = await ProductService.getList({ sort, page });

  const breadcrumbItems = [{ label: "Каталог" }];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Головна", url: SITE_URL },
          { name: "Каталог", url: `${SITE_URL}/katalog/` },
        ])}
      />
      <JsonLd
        data={buildItemListJsonLd(
          products.map((p) => ({
            name: p.name,
            url: `${SITE_URL}/${p.slug}/`,
          }))
        )}
      />

      <Breadcrumbs items={breadcrumbItems} />

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Каталог</h1>
        <Suspense>
          <SortingSelect />
        </Suspense>
      </div>

      <div className="mt-6">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
