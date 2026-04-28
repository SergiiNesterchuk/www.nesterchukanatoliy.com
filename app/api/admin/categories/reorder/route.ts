import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const PATCH = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const items = body.items as Array<{ id: string; sortOrder: number }>;

    if (!items || !Array.isArray(items)) {
      return errorResponse(new Error("items array required"));
    }

    for (const { id, sortOrder } of items) {
      if (typeof id !== "string" || typeof sortOrder !== "number") {
        return errorResponse(new Error("Invalid item: id (string) and sortOrder (number) required"));
      }
    }

    await prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        prisma.category.update({ where: { id }, data: { sortOrder } })
      )
    );

    return successResponse({ reordered: true });
  } catch (error) {
    return errorResponse(error);
  }
});
