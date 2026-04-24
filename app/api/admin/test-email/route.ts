import { NextRequest } from "next/server";
import { adminGuard } from "@/shared/admin-auth";
import { EmailService } from "@/services/EmailService";
import { successResponse, errorResponse } from "@/shared/api-response";

export const POST = adminGuard(async (req: NextRequest) => {
  try {
    const { email } = await req.json();
    if (!email) return errorResponse(new Error("Email required"));

    const result = await EmailService.sendTestEmail(email);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
