import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/keycrm-payment-methods?orderId=3926
 *
 * Discovery endpoint:
 * 1. Пробує знайти список способів оплати KeyCRM API
 * 2. Якщо передано orderId — показує payment objects з конкретного замовлення
 *
 * READ-ONLY. Не змінює жодних даних.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");
  const orderId = request.nextUrl.searchParams.get("orderId");

  if (!apiKey) {
    return NextResponse.json({ error: "KEYCRM_API_KEY not set" }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  // 1. Спробувати різні endpoints для списку способів оплати
  const methodEndpoints = [
    "/payment-method",
    "/payment-methods",
    "/order/payment-method",
    "/order/payment-methods",
    "/payments",
    "/payment",
    "/payment/methods",
  ];

  for (const ep of methodEndpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        results[`GET ${ep}`] = {
          httpStatus: res.status,
          data: Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : data,
        };
      } else {
        results[`GET ${ep}`] = { httpStatus: res.status };
      }
    } catch (e) {
      results[`GET ${ep}`] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // 2. Якщо передано orderId — отримати payment objects
  if (orderId) {
    try {
      const res = await fetch(`${baseUrl}/order/${orderId}?include=payments`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const payments = data.payments || [];
        results[`order_${orderId}_payments`] = {
          paymentsCount: payments.length,
          payments: payments.map((p: Record<string, unknown>) => {
            // Показати ВСІ ключі payment object
            const result: Record<string, unknown> = { _allKeys: Object.keys(p) };
            for (const [key, val] of Object.entries(p)) {
              if (val === null || val === undefined) continue;
              if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                result[key] = val;
              } else if (typeof val === "object") {
                result[key] = JSON.stringify(val).substring(0, 200);
              }
            }
            return result;
          }),
          orderPaymentStatus: data.payment_status,
          orderPaymentsTotal: data.payments_total,
        };
      } else {
        results[`order_${orderId}_payments`] = { httpStatus: res.status };
      }
    } catch (e) {
      results[`order_${orderId}_payments`] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({ results });
}
