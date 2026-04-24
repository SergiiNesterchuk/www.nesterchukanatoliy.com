import { NextRequest } from "next/server";
import { NovaPoshtaService } from "@/integrations/novaposhta/NovaPoshtaClient";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query") || "";
    const results = await NovaPoshtaService.searchSettlements(query);
    return successResponse(results);
  } catch (error) {
    return errorResponse(error);
  }
}
