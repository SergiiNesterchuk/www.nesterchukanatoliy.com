import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { pageSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async () => {
  try {
    const pages = await prisma.page.findMany({ orderBy: { sortOrder: "asc" } });
    return successResponse(pages);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const data = pageSchema.parse(body);
    const existing = await prisma.page.findFirst({ where: { slug: data.slug } });
    if (existing) return errorResponse(new Error("Slug вже існує"));

    const page = await prisma.page.create({
      data: {
        ...data,
        metaTitle: data.metaTitle || null,
        metaDesc: data.metaDesc || null,
      },
    });
    return successResponse(page, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
