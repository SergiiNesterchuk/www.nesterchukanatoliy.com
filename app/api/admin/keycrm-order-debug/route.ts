import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/keycrm-order-debug?orderId=3912
 * Tries multiple KeyCRM API endpoints/includes to find TTN/delivery data.
 * For diagnostics only — discovers which fields contain tracking info.
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId query param required" }, { status: 400 });
  }

  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");
  if (!apiKey) {
    return NextResponse.json({ error: "KEYCRM_API_KEY not set" }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  // Try various includes
  const includeVariants = [
    "",
    "payments",
    "payments,shipping",
    "payments,delivery",
    "payments,shipments",
    "payments,shipping_data",
    "payments,delivery_data",
    "payments,tracking",
    "payments,expenses",
  ];

  for (const inc of includeVariants) {
    const url = inc ? `${baseUrl}/order/${orderId}?include=${inc}` : `${baseUrl}/order/${orderId}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      const status = res.status;
      if (res.ok) {
        const data = await res.json();
        // Extract only relevant fields
        results[`include=${inc || "(none)"}`] = {
          httpStatus: status,
          topKeys: Object.keys(data),
          tracking_code: data.tracking_code ?? "MISSING",
          ttn: data.ttn ?? "MISSING",
          tracking_number: data.tracking_number ?? "MISSING",
          shipping: data.shipping ? summarize(data.shipping) : "MISSING",
          delivery: data.delivery ? summarize(data.delivery) : "MISSING",
          deliveries: data.deliveries ? `[${(data.deliveries as unknown[]).length} items]` : "MISSING",
          shipments: data.shipments ? `[${(data.shipments as unknown[]).length} items]` : "MISSING",
          shipping_data: data.shipping_data ? summarize(data.shipping_data) : "MISSING",
          delivery_data: data.delivery_data ? summarize(data.delivery_data) : "MISSING",
          expenses: data.expenses ? summarize(data.expenses) : "MISSING",
        };
      } else {
        const body = await res.text().catch(() => "");
        results[`include=${inc || "(none)"}`] = { httpStatus: status, error: body.substring(0, 300) };
      }
    } catch (e) {
      results[`include=${inc || "(none)"}`] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Also try separate endpoints
  const separateEndpoints = [
    `/order/${orderId}/shipping`,
    `/order/${orderId}/delivery`,
    `/order/${orderId}/ttn`,
  ];
  for (const ep of separateEndpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        results[`endpoint=${ep}`] = { httpStatus: res.status, data: summarize(data) };
      } else {
        results[`endpoint=${ep}`] = { httpStatus: res.status };
      }
    } catch {
      results[`endpoint=${ep}`] = { error: "fetch failed" };
    }
  }

  return NextResponse.json({ orderId, results });
}

function summarize(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => summarize(item));
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val === null || val === undefined) continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[key] = val;
    } else if (Array.isArray(val)) {
      result[key] = `[${val.length} items]`;
    } else {
      result[key] = `{${Object.keys(val as object).join(",")}}`;
    }
  }
  return result;
}
