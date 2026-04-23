import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { categorySchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const PUT = adminGuard(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = categorySchema.partial().parse(body);

    if (data.slug) {
      const conflict = await prisma.category.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (conflict) return errorResponse(new Error("Slug вже існує"));
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value === "" ? null : value;
    }

    const category = await prisma.category.update({ where: { id }, data: updateData });
    return successResponse(category);
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return errorResponse(new Error(`Неможливо видалити: ${productsCount} товарів у цій категорії`));
    }
    await prisma.category.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
