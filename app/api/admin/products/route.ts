import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { productCreateSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";
import { isAutoSlug, resolveSlugForCreate } from "@/shared/slug-namespace";
import { ValidationError } from "@/shared/errors";

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

    // Preprocess empty strings for optional numeric fields
    if (body.compareAtPrice === "" || body.compareAtPrice === null) body.compareAtPrice = undefined;
    if (body.quantity === "" || body.quantity === null) body.quantity = undefined;
    if (body.sortOrder === "") body.sortOrder = 0;

    const data = productCreateSchema.parse(body);

    const skuTaken = await prisma.product.findFirst({ where: { sku: data.sku } });
    if (skuTaken) throw new ValidationError("SKU вже існує");

    const slug = await resolveSlugForCreate(data.slug, isAutoSlug(body));

    const product = await prisma.product.create({
      data: {
        ...data,
        slug,
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
