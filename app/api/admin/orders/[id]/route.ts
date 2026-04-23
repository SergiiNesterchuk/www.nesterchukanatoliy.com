import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const GET = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) return errorResponse(new Error("Order not found"));

    const integrationLogs = await prisma.integrationLog.findMany({
      where: { entityType: "order", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return successResponse({ ...order, integrationLogs });
  } catch (error) {
    return errorResponse(error);
  }
});
