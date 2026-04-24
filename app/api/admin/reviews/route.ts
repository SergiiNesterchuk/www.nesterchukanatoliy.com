import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async (req: NextRequest) => {
  try {
    const status = req.nextUrl.searchParams.get("status") || "";
    const where = status ? { status } : {};

    const reviews = await prisma.productReview.findMany({
      where,
      include: { product: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return successResponse(reviews);
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const review = await prisma.productReview.create({
      data: {
        productId: body.productId,
        customerName: body.customerName || "Адміністратор",
        rating: body.rating || 5,
        text: body.text,
        status: "approved",
        source: "admin",
        approvedAt: new Date(),
      },
    });
    return successResponse(review, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
