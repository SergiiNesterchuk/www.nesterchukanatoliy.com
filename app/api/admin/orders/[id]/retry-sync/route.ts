import { NextRequest } from "next/server";
import { adminGuard } from "@/shared/admin-auth";
import { KeyCRMService } from "@/services/KeyCRMService";
import { successResponse, errorResponse } from "@/shared/api-response";

export const POST = adminGuard(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (process.env.CRM_SYNC_ENABLED === "false") {
      return errorResponse(new Error("CRM sync is disabled"));
    }

    const service = new KeyCRMService();
    const result = await service.retrySync(id);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
