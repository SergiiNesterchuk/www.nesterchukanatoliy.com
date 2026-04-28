import { prisma } from "@/shared/db";
import { notFound } from "next/navigation";
import { CategoryEditForm } from "../CategoryEditForm";

export const dynamic = "force-dynamic";

export default async function AdminCategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Редагування: {category.name}
      </h1>
      <CategoryEditForm category={category} />
    </div>
  );
}
