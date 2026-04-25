import { NextResponse } from "next/server";
import { KEYCRM_STATUS_ID_MAP, KEYCRM_STATUS_GROUP_MAP } from "@/shared/keycrm-status-map";

/**
 * GET /api/admin/keycrm-statuses
 * Fetches the list of order statuses from KeyCRM API and shows current mapping.
 * Useful for discovering status IDs and verifying mapping config.
 */
export async function GET() {
  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");

  if (!apiKey) {
    return NextResponse.json({ error: "KEYCRM_API_KEY not set" }, { status: 500 });
  }

  // Try to fetch statuses from KeyCRM API
  let keycrmStatuses: unknown = null;
  let fetchError: string | null = null;

  // KeyCRM v1 endpoint for order statuses
  const endpoints = [
    "/order/status",
    "/order-status",
    "/statuses",
    "/order/statuses",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      if (res.ok) {
        keycrmStatuses = await res.json();
        break;
      }
    } catch {
      // Try next endpoint
    }
  }

  if (!keycrmStatuses) {
    fetchError = "Could not fetch statuses from KeyCRM API (tried multiple endpoints)";
  }

  return NextResponse.json({
    success: true,
    currentMapping: {
      statusIdMap: KEYCRM_STATUS_ID_MAP,
      statusGroupMap: KEYCRM_STATUS_GROUP_MAP,
    },
    keycrmStatuses,
    fetchError,
    instructions: "Update KEYCRM_STATUS_ID_MAP in shared/keycrm-status-map.ts with the correct IDs",
  });
}
