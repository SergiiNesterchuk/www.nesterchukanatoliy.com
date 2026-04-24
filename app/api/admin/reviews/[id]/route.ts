import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const PUT = adminGuard(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "approved") updateData.approvedAt = new Date();
    }
    if (body.customerName !== undefined) updateData.customerName = body.customerName;
    if (body.text !== undefined) updateData.text = body.text;
    if (body.rating !== undefined) updateData.rating = body.rating;

    const review = await prisma.productReview.update({ where: { id }, data: updateData });
    return successResponse(review);
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
    await prisma.productReview.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
});
