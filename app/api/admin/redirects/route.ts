import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { redirectSchema } from "@/validators/admin.schema";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async () => {
  try {
    const redirects = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
    return successResponse(redirects);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const data = redirectSchema.parse(body);

    const existing = await prisma.redirect.findFirst({ where: { fromPath: data.fromPath } });
    if (existing) return errorResponse(new Error("Цей шлях вже має redirect"));

    const redirect = await prisma.redirect.create({ data });
    return successResponse(redirect, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
