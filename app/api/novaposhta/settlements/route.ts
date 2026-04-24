import { NextRequest, NextResponse } from "next/server";
import { NovaPoshtaService } from "@/integrations/novaposhta/NovaPoshtaClient";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query") || "";
    if (query.length < 2) return NextResponse.json({ success: true, data: [] });

    const results = await NovaPoshtaService.searchSettlements(query);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка Нової Пошти";
    return NextResponse.json({ success: false, data: [], error: { message } });
  }
}
