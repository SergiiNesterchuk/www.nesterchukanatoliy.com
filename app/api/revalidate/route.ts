import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { KeyCRMService } from "@/services/KeyCRMService";

// Cron endpoint: processes pending CRM syncs and revalidates cache
// Call via cron job: POST /api/revalidate?secret=YOUR_SECRET
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_JWT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action");

  if (action === "sync") {
    // Process pending KeyCRM syncs
    const result = await KeyCRMService.processPendingSyncs();
    return NextResponse.json({ action: "sync", ...result });
  }

  if (action === "revalidate") {
    const path = request.nextUrl.searchParams.get("path") || "/";
    revalidatePath(path);
    return NextResponse.json({ action: "revalidate", path, revalidated: true });
  }

  // Default: run both
  const syncResult = await KeyCRMService.processPendingSyncs();
  revalidatePath("/");
  return NextResponse.json({
    sync: syncResult,
    revalidated: true,
  });
}
