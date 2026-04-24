import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

// POST: resolve or clear logs
export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const body = await req.json();

    if (body.action === "resolve" && body.id) {
      await prisma.integrationLog.update({
        where: { id: body.id },
        data: { isResolved: true, resolvedAt: new Date() },
      });
      return successResponse({ resolved: true });
    }

    if (body.action === "resolve_all") {
      const result = await prisma.integrationLog.updateMany({
        where: { isResolved: false, responseStatus: { gte: 400 } },
        data: { isResolved: true, resolvedAt: new Date() },
      });
      return successResponse({ resolved: result.count });
    }

    return errorResponse(new Error("Unknown action"));
  } catch (error) {
    return errorResponse(error);
  }
});
