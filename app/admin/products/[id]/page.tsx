import { prisma } from "@/shared/db";
import { notFound } from "next/navigation";
import { ProductEditForm } from "./ProductEditForm";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Редагування: {product.name}
      </h1>
      <ProductEditForm product={product} categories={categories} images={product.images} />
    </div>
  );
}
