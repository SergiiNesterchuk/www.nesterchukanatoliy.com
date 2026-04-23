import { prisma } from "@/shared/db";
import { ProductEditForm } from "../[id]/ProductEditForm";

export const dynamic = "force-dynamic";

const emptyProduct = {
  id: "",
  name: "",
  slug: "",
  sku: "",
  shortDescription: null,
  description: null,
  price: 0,
  compareAtPrice: null,
  stockStatus: "in_stock",
  quantity: null,
  categoryId: "",
  isActive: true,
  sortOrder: 0,
  metaTitle: null,
  metaDesc: null,
};

export default async function AdminProductNewPage() {
  let categories: { id: string; name: string }[] = [];
  try {
    categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch { /* */ }

  const product = {
    ...emptyProduct,
    categoryId: categories[0]?.id ?? "",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Новий товар</h1>
      <ProductEditForm product={product} categories={categories} isNew />
    </div>
  );
}
