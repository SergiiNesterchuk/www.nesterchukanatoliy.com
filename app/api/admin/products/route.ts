import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { productCreateSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async (req: NextRequest) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return successResponse(products);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const data = productCreateSchema.parse(body);

    const existing = await prisma.product.findFirst({
      where: { OR: [{ slug: data.slug }, { sku: data.sku }] },
    });
    if (existing) {
      return errorResponse(
        new Error(existing.slug === data.slug ? "Slug вже існує" : "SKU вже існує")
      );
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        shortDescription: data.shortDescription || null,
        description: data.description || null,
        compareAtPrice: data.compareAtPrice || null,
        quantity: data.quantity ?? null,
        metaTitle: data.metaTitle || null,
        metaDesc: data.metaDesc || null,
      },
      include: { category: true, images: true },
    });
    return successResponse(product, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
