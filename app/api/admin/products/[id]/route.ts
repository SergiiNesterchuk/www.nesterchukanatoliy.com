import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { productUpdateSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) {
      return errorResponse(new Error("Product not found"));
    }
    return successResponse(product);
  } catch (error) {
    return errorResponse(error);
  }
});

export const PUT = adminGuard(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = productUpdateSchema.parse(body);

    if (data.slug) {
      const conflict = await prisma.product.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (conflict) return errorResponse(new Error("Slug вже існує"));
    }
    if (data.sku) {
      const conflict = await prisma.product.findFirst({
        where: { sku: data.sku, NOT: { id } },
      });
      if (conflict) return errorResponse(new Error("SKU вже існує"));
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value === "" ? null : value;
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, images: true },
    });
    return successResponse(product);
  } catch (error) {
    console.error("[Admin] Product update failed:", error instanceof Error ? error.message : error);
    return errorResponse(error);
  }
});

export const DELETE = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
