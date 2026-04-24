import { NextRequest, NextResponse } from "next/server";
import { NovaPoshtaService } from "@/integrations/novaposhta/NovaPoshtaClient";

export async function GET(request: NextRequest) {
  try {
    const cityRef = request.nextUrl.searchParams.get("cityRef") || "";
    const type = (request.nextUrl.searchParams.get("type") || "all") as "branch" | "postomat" | "all";
    if (!cityRef) return NextResponse.json({ success: true, data: [] });

    const results = await NovaPoshtaService.getWarehouses(cityRef, type);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка Нової Пошти";
    return NextResponse.json({ success: false, data: [], error: { message } });
  }
}
