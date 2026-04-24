import { NextRequest } from "next/server";
import { prisma } from "@/shared/db";
import { adminGuard } from "@/shared/admin-auth";
import { successResponse, errorResponse } from "@/shared/api-response";

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    let action = "";
    let id = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      action = body.action || "";
      id = body.id || "";
    } else {
      // Form submission
      const formData = await req.formData();
      action = (formData.get("action") as string) || "";
      id = (formData.get("id") as string) || "";
    }

    if (action === "resolve" && id) {
      await prisma.integrationLog.update({
        where: { id },
        data: { isResolved: true, resolvedAt: new Date() },
      });
      return successResponse({ resolved: true });
    }

    if (action === "resolve_all") {
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
