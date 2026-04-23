import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { pageSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const page = await prisma.page.findUnique({ where: { id } });
    if (!page) return errorResponse(new Error("Page not found"));
    return successResponse(page);
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
    const data = pageSchema.partial().parse(body);

    if (data.slug) {
      const conflict = await prisma.page.findFirst({ where: { slug: data.slug, NOT: { id } } });
      if (conflict) return errorResponse(new Error("Slug вже існує"));
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value === "" ? null : value;
    }

    const page = await prisma.page.update({ where: { id }, data: updateData });
    return successResponse(page);
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
    await prisma.page.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
