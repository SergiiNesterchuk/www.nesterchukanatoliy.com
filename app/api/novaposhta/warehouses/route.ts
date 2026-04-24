import { NextRequest } from "next/server";
import { NovaPoshtaService } from "@/integrations/novaposhta/NovaPoshtaClient";
import { successResponse, errorResponse } from "@/shared/api-response";

export async function GET(request: NextRequest) {
  try {
    const cityRef = request.nextUrl.searchParams.get("cityRef") || "";
    const type = (request.nextUrl.searchParams.get("type") || "all") as "branch" | "postomat" | "all";
    const results = await NovaPoshtaService.getWarehouses(cityRef, type);
    return successResponse(results);
  } catch (error) {
    return errorResponse(error);
  }
}
