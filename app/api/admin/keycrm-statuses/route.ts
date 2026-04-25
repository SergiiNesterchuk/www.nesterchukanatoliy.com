import { NextResponse } from "next/server";
import { refreshStatusCache, getStatusCacheSnapshot } from "@/shared/keycrm-status-map";

/**
 * GET /api/admin/keycrm-statuses
 * Refreshes status cache from KeyCRM API and returns current mapping.
 */
export async function GET() {
  await refreshStatusCache();
  const snapshot = getStatusCacheSnapshot();

  return NextResponse.json({
    success: true,
    cache: snapshot,
    entries: Object.values(snapshot.entries).map((e) => ({
      id: e.id,
      name: e.name,
      mapped: e.mapped || "UNMAPPED",
    })),
  });
}
