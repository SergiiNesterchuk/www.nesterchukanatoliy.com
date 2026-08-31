import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { pageSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";
import { isAutoSlug, resolveSlugForCreate } from "@/shared/slug-namespace";

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
    const slug = await resolveSlugForCreate(data.slug, isAutoSlug(body));

    const page = await prisma.page.create({
      data: {
        ...data,
        slug,
        metaTitle: data.metaTitle || null,
        metaDesc: data.metaDesc || null,
      },
    });
    return successResponse(page, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
