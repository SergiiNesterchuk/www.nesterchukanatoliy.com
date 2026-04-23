import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { categorySchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async () => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });
    return successResponse(categories);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const data = categorySchema.parse(body);

    const existing = await prisma.category.findFirst({ where: { slug: data.slug } });
    if (existing) return errorResponse(new Error("Slug вже існує"));

    const category = await prisma.category.create({
      data: {
        ...data,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        metaTitle: data.metaTitle || null,
        metaDesc: data.metaDesc || null,
      },
    });
    return successResponse(category, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
