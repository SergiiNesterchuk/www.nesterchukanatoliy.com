import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async () => {
  try {
    const methods = await prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } });
    return successResponse(methods);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const method = await prisma.paymentMethod.create({ data: body });
    return successResponse(method, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
