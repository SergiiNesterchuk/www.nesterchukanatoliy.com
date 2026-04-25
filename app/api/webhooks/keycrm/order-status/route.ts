import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { createLogger } from "@/shared/logger";
import { mapKeycrmToPublicStatus } from "@/shared/keycrm-status-map";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";

const logger = createLogger("KeyCRM:Webhook");
const ENDPOINT = "/api/webhooks/keycrm/order-status";

/**
 * Production webhook endpoint for KeyCRM.
 *
 * KeyCRM webhook payload: { event: "...", context: { id: ... } }
 *
 * Strategy: ANY webhook → extract keycrmOrderId → fetch full order from
 * KeyCRM API → sync ALL dimensions (status + payment + delivery/tracking).
 */
export async function POST(request: NextRequest) {
  // --- Auth ---
  const secret =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.KEYCRM_WEBHOOK_SECRET || process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    logger.warn("Webhook: invalid JSON body");
    return NextResponse.json({ status: "ok", skipped: true, reason: "invalid_json" });
  }

  try {
    const eventName = String(payload.event || "");
    const context = (payload.context || payload) as Record<string, unknown>;
    const keycrmOrderId = extractKeycrmOrderId(context, payload);

    logger.info("Webhook received", {
      event: eventName,
      keycrmOrderId,
      contextKeys: context ? Object.keys(context) : [],
    });

    // Log raw webhook payload for diagnostics
    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: ENDPOINT,
      entityType: "webhook_raw",
      entityId: keycrmOrderId || undefined,
      responseStatus: 200,
      requestBody: sanitizePayloadForLog(payload),
    });

    if (!keycrmOrderId) {
      logger.warn("Webhook: no order ID found", { event: eventName });
      return NextResponse.json({ status: "ok", skipped: true, reason: "no_order_id" });
    }

    // --- Unified snapshot sync: fetch order and sync ALL dimensions ---
    return await syncOrderSnapshot(keycrmOrderId, eventName);
  } catch (error) {
    logger.error("Webhook processing error", {
      error: error instanceof Error ? error.message : String(error),
    });

    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: ENDPOINT,
      entityType: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      requestBody: sanitizePayloadForLog(payload),
    });

    return NextResponse.json({ status: "ok", error: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractKeycrmOrderId(context: Record<string, unknown>, payload: Record<string, unknown>): string {
  const id = context?.id || context?.order_id || context?.model_id
    || payload.id || payload.order_id || "";
  return String(id);
}

function sanitizePayloadForLog(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload, null, 0).substring(0, 4000);
  } catch {
    return "{}";
  }
}

/** Summarize an object for logging: show keys + string/number values, skip large nested objects */
function summarizeObj(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== "object") return null;
  const result: Record<string, unknown> = { _keys: Object.keys(obj as Record<string, unknown>) };
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val === null || val === undefined) continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[key] = val;
    } else if (typeof val === "object" && !Array.isArray(val)) {
      result[key] = `{${Object.keys(val as object).join(",")}}`;
    } else if (Array.isArray(val)) {
      result[key] = `[${val.length} items]`;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Unified snapshot sync
// ---------------------------------------------------------------------------

async function syncOrderSnapshot(keycrmOrderId: string, eventName: string) {
  // 1. Find local order
  const order = await prisma.order.findFirst({ where: { keycrmOrderId } });
  if (!order) {
    logger.warn("Webhook: order not found locally", { keycrmOrderId, event: eventName });
    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: ENDPOINT,
      entityType: "order",
      entityId: keycrmOrderId,
      errorMessage: "Order not found locally",
    });
    return NextResponse.json({ status: "ok", skipped: true, reason: "order_not_found" });
  }

  // 2. Fetch full order from KeyCRM API
  const keycrmOrder = await fetchKeycrmOrder(keycrmOrderId);
  if (!keycrmOrder) {
    logger.warn("Webhook: KeyCRM API fetch failed", { keycrmOrderId });
    return NextResponse.json({ status: "ok", skipped: true, reason: "api_fetch_failed" });
  }

  // 3. Extract ALL fields with robust multi-path extraction + debug logging
  const extracted = extractOrderFields(keycrmOrder);

  logger.info("Webhook: extracted fields from KeyCRM API", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    event: eventName,
    keycrmStatusId: extracted.statusId,
    keycrmStatusName: extracted.statusName,
    trackingCode: extracted.trackingCode,
    deliveryStatusRaw: extracted.deliveryStatusRaw,
    keycrmPaymentStatus: extracted.paymentStatus,
    paymentsCount: extracted.paymentsCount,
    // Debug: show what raw fields were found
    rawStatusType: extracted.debug.statusType,
    rawStatusKeys: extracted.debug.statusKeys,
    rawTrackingFields: extracted.debug.trackingFields,
    rawTopLevelKeys: extracted.debug.topLevelKeys,
  });

  // 4. Sync each dimension independently (no early-return)
  const updateData: Record<string, unknown> = {};
  const historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }> = [];

  // --- A. Order status ---
  syncOrderStatus(extracted, order, updateData, historyEntries);

  // --- B. Delivery + Tracking ---
  syncDeliveryAndTracking(extracted, order, updateData, historyEntries);

  // --- C. Payment status ---
  syncPaymentStatus(keycrmOrder, order, updateData, historyEntries);

  // 5. Apply updates
  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({ where: { id: order.id }, data: updateData });
  }

  for (const entry of historyEntries) {
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, ...entry },
    });
  }

  // 6. Log result
  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "order_sync",
    entityId: order.id,
    responseStatus: 200,
  });

  const updated = Object.keys(updateData).length > 0;
  logger.info(updated ? "Webhook: order synced" : "Webhook: no changes", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    event: eventName,
    updatedFields: Object.keys(updateData),
    historyCount: historyEntries.length,
  });

  return NextResponse.json({
    status: "ok",
    updated,
    updatedFields: Object.keys(updateData),
  });
}

// ---------------------------------------------------------------------------
// Field extraction — try ALL known paths
// ---------------------------------------------------------------------------

interface ExtractedFields {
  statusId: number | undefined;
  statusName: string;
  trackingCode: string | null;
  deliveryStatusRaw: string; // raw delivery/shipping status from KeyCRM
  paymentStatus: string;
  paymentsCount: number;
  debug: {
    statusType: string;
    statusKeys: string[];
    trackingFields: string[];
    topLevelKeys: string[];
  };
}

function extractOrderFields(keycrmOrder: Record<string, unknown>): ExtractedFields {
  const topLevelKeys = Object.keys(keycrmOrder);

  // --- Status extraction: try multiple paths ---
  let statusId: number | undefined;
  let statusName = "";
  const statusRaw = keycrmOrder.status;
  let statusType = typeof statusRaw;
  let statusKeys: string[] = [];

  if (statusRaw && typeof statusRaw === "object" && !Array.isArray(statusRaw)) {
    // status is an object: { id: N, name: "..." }
    const statusObj = statusRaw as Record<string, unknown>;
    statusKeys = Object.keys(statusObj);
    statusName = String(statusObj.name || statusObj.title || statusObj.label || "");
    const rawId = statusObj.id;
    if (typeof rawId === "number" && rawId > 0) statusId = rawId;
    else if (typeof rawId === "string" && rawId) statusId = parseInt(rawId, 10) || undefined;
  } else if (typeof statusRaw === "string") {
    // status is a string (the status name directly)
    statusName = statusRaw;
    statusType = "string";
  } else if (typeof statusRaw === "number") {
    // status is a number (the status ID directly)
    statusId = statusRaw;
    statusType = "number";
  }

  // Fallback: try top-level status_name / status_id
  if (!statusName && keycrmOrder.status_name) {
    statusName = String(keycrmOrder.status_name);
  }
  if (!statusId && keycrmOrder.status_id) {
    const rawSid = keycrmOrder.status_id;
    statusId = typeof rawSid === "number" ? rawSid : parseInt(String(rawSid), 10) || undefined;
  }
  // Also try current_status, workflow_status
  if (!statusName && keycrmOrder.current_status) {
    const cs = keycrmOrder.current_status;
    if (typeof cs === "string") statusName = cs;
    else if (typeof cs === "object" && cs !== null) statusName = String((cs as Record<string, unknown>).name || "");
  }

  // --- Tracking extraction: try ALL possible paths ---
  const trackingFields: string[] = [];
  let trackingCode: string | null = null;

  const trackingPaths: unknown[] = [
    // Top-level fields
    keycrmOrder.tracking_code,
    keycrmOrder.ttn,
    keycrmOrder.trackingNumber,
    keycrmOrder.tracking_number,
    keycrmOrder.delivery_tracking_code,
    keycrmOrder.shipping_tracking_code,
  ];

  // Nested shipping object
  const shipping = keycrmOrder.shipping as Record<string, unknown> | undefined;
  if (shipping && typeof shipping === "object") {
    trackingPaths.push(
      shipping.tracking_code, shipping.ttn, shipping.tracking_number,
      shipping.trackingNumber, shipping.delivery_tracking_code,
    );
  }

  // Nested delivery object
  const delivery = keycrmOrder.delivery as Record<string, unknown> | undefined;
  if (delivery && typeof delivery === "object") {
    trackingPaths.push(
      delivery.tracking_code, delivery.ttn, delivery.tracking_number,
      delivery.trackingNumber,
    );
  }

  // deliveries array
  const deliveries = keycrmOrder.deliveries as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(deliveries) && deliveries.length > 0) {
    const d0 = deliveries[0];
    trackingPaths.push(
      d0.tracking_code, d0.ttn, d0.tracking_number, d0.trackingNumber,
    );
  }

  // shipments array
  const shipments = keycrmOrder.shipments as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(shipments) && shipments.length > 0) {
    const s0 = shipments[0];
    trackingPaths.push(
      s0.tracking_code, s0.ttn, s0.tracking_number, s0.trackingNumber,
    );
  }

  for (const val of trackingPaths) {
    if (val && typeof val === "string" && val.trim()) {
      trackingCode = val.trim();
      break;
    }
  }

  // Log which tracking-related fields exist at top level
  for (const key of [
    "tracking_code", "ttn", "trackingNumber", "tracking_number",
    "delivery_tracking_code", "shipping_tracking_code",
    "shipping", "delivery", "deliveries", "shipments",
  ]) {
    if (keycrmOrder[key] !== undefined) trackingFields.push(key);
  }

  // --- Delivery status extraction ---
  let deliveryStatusRaw = "";
  const deliveryStatusPaths = [
    keycrmOrder.delivery_status,
    keycrmOrder.shipping_status,
    keycrmOrder.tracking_status,
    keycrmOrder.current_delivery_status,
  ];
  if (shipping && typeof shipping === "object") {
    deliveryStatusPaths.push((shipping as Record<string, unknown>).status);
  }
  if (delivery && typeof delivery === "object") {
    deliveryStatusPaths.push((delivery as Record<string, unknown>).status);
  }
  if (Array.isArray(deliveries) && deliveries.length > 0) {
    deliveryStatusPaths.push(deliveries[0].status, deliveries[0].delivery_status);
  }
  // shipments already defined above in tracking extraction
  if (Array.isArray(shipments) && shipments.length > 0) {
    deliveryStatusPaths.push(shipments[0].status, shipments[0].delivery_status);
  }

  for (const val of deliveryStatusPaths) {
    if (val && typeof val === "string" && val.trim()) {
      deliveryStatusRaw = val.trim();
      break;
    }
  }

  // --- Payment status ---
  const paymentStatus = String(keycrmOrder.payment_status || "");
  const payments = keycrmOrder.payments as Array<unknown> | undefined;
  const paymentsCount = Array.isArray(payments) ? payments.length : 0;

  return {
    statusId,
    statusName,
    trackingCode,
    deliveryStatusRaw,
    paymentStatus,
    paymentsCount,
    debug: {
      statusType,
      statusKeys,
      trackingFields,
      topLevelKeys,
    },
  };
}

// ---------------------------------------------------------------------------
// Dimension sync: Order status
// ---------------------------------------------------------------------------

function syncOrderStatus(
  extracted: ExtractedFields,
  order: { id: string; status: string; keycrmStatusName: string | null },
  updateData: Record<string, unknown>,
  historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }>
) {
  const { statusId, statusName } = extracted;

  // Skip if no status info extracted at all
  if (!statusName && !statusId) {
    logger.warn("syncOrderStatus: no status data extracted", {
      orderId: order.id,
      rawStatusType: extracted.debug.statusType,
      rawStatusKeys: extracted.debug.statusKeys,
    });
    return;
  }

  const newPublicStatus = mapKeycrmToPublicStatus(statusId, statusName);
  const oldPublicStatus = order.status;

  logger.info("syncOrderStatus: mapping result", {
    orderId: order.id,
    keycrmStatusId: statusId,
    keycrmStatusName: statusName,
    mappedPublicStatus: newPublicStatus,
    oldLocalStatus: oldPublicStatus,
    oldKeycrmStatusName: order.keycrmStatusName,
    willUpdate: oldPublicStatus !== newPublicStatus || order.keycrmStatusName !== statusName,
  });

  // Only update if public status or KeyCRM sub-status actually changed
  if (oldPublicStatus === newPublicStatus && order.keycrmStatusName === statusName) return;

  updateData.status = newPublicStatus;
  updateData.keycrmStatusId = statusId || null;
  updateData.keycrmStatusName = statusName;

  if (oldPublicStatus !== newPublicStatus) {
    const statusLabels: Record<string, string> = {
      new: "Нове", approval: "Готується до відправки", production: "Виробництво",
      delivery: "Доставка", completed: "Виконано", cancelled: "Скасовано",
    };
    historyEntries.push({
      source: "keycrm_webhook",
      oldStatus: oldPublicStatus,
      newStatus: newPublicStatus,
      message: `Статус змінено: ${statusLabels[newPublicStatus] || statusName}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Dimension sync: Delivery + Tracking
// ---------------------------------------------------------------------------

/** Map KeyCRM/Nova Poshta delivery status keywords → local deliveryStatus */
function mapDeliveryStatus(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const rules: Array<{ keywords: string[]; status: string }> = [
    { keywords: ["доставлено", "отримано", "received", "delivered"], status: "delivered" },
    { keywords: ["прибуло", "очікує отримання", "arrived", "ready for pickup"], status: "arrived" },
    { keywords: ["у дорозі", "в дорозі", "in transit", "transiting"], status: "in_transit" },
    { keywords: ["відправлен", "передано в доставку", "передано у доставку", "shipped", "sending"], status: "shipped" },
    { keywords: ["створена накладна", "створено накладну", "label created"], status: "shipped" },
    { keywords: ["повернення", "повертається", "returned", "returning"], status: "returned" },
    { keywords: ["проблема", "не доставлено", "problem", "issue", "failed delivery"], status: "delivery_issue" },
    { keywords: ["готується", "preparing", "збирається"], status: "preparing" },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.status;
    }
  }
  return null;
}

const DELIVERY_HISTORY_MAP: Record<string, string> = {
  preparing: "Замовлення готується до відправки",
  shipped: "Замовлення відправлено",
  in_transit: "Замовлення в дорозі",
  arrived: "Замовлення прибуло у відділення",
  delivered: "Замовлення доставлено",
  returned: "Замовлення повертається",
  delivery_issue: "Проблема з доставкою замовлення",
};

function syncDeliveryAndTracking(
  extracted: ExtractedFields,
  order: { id: string; deliveryStatus: string | null; trackingNumber: string | null; shippedAt: Date | null; deliveredAt: Date | null; status: string },
  updateData: Record<string, unknown>,
  historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }>
) {
  const effectiveStatus = (updateData.status as string) || order.status;
  const oldDelivery = order.deliveryStatus || "pending";

  // --- 1. Try to map delivery status from KeyCRM raw delivery status ---
  const mappedDelivery = mapDeliveryStatus(extracted.deliveryStatusRaw);
  let newDelivery: string | null = null;

  if (mappedDelivery && mappedDelivery !== oldDelivery) {
    newDelivery = mappedDelivery;
  }

  // --- 2. Infer from order status if no explicit delivery status ---
  if (!newDelivery) {
    if (effectiveStatus === "delivery" && oldDelivery !== "shipped" && oldDelivery !== "in_transit" && oldDelivery !== "arrived") {
      newDelivery = "shipped";
    }
    if (effectiveStatus === "completed" && oldDelivery !== "delivered") {
      newDelivery = "delivered";
    }
  }

  // --- 3. Tracking number ---
  const { trackingCode } = extracted;
  let trackingChanged = false;

  if (trackingCode && trackingCode !== order.trackingNumber) {
    // TTN added or changed
    updateData.trackingNumber = trackingCode;
    trackingChanged = true;

    // If tracking appeared and no delivery status yet, mark shipped
    if (!newDelivery && (oldDelivery === "pending" || !order.deliveryStatus)) {
      newDelivery = "shipped";
    }
  } else if (!trackingCode && order.trackingNumber) {
    // TTN was removed in KeyCRM
    updateData.trackingNumber = null;
    trackingChanged = true;
  }

  // --- 4. Apply delivery status ---
  if (newDelivery) {
    updateData.deliveryStatus = newDelivery;
    if (newDelivery === "shipped" && !order.shippedAt) updateData.shippedAt = new Date();
    if (newDelivery === "delivered" && !order.deliveredAt) updateData.deliveredAt = new Date();

    // Build history message
    let message = DELIVERY_HISTORY_MAP[newDelivery] || `Статус доставки: ${newDelivery}`;
    if (trackingChanged && trackingCode && (newDelivery === "shipped" || newDelivery === "preparing")) {
      message = `Замовлення передано в доставку. ТТН: ${trackingCode}`;
    }

    historyEntries.push({
      source: "delivery",
      oldStatus: oldDelivery,
      newStatus: newDelivery,
      message,
    });
  }

  // --- 5. Tracking-only history (when delivery status didn't change) ---
  if (trackingChanged && !newDelivery) {
    if (trackingCode && !order.trackingNumber) {
      // TTN added
      historyEntries.push({
        source: "delivery",
        oldStatus: oldDelivery,
        newStatus: oldDelivery,
        message: `ТТН додано: ${trackingCode}`,
      });
    } else if (trackingCode && order.trackingNumber && trackingCode !== order.trackingNumber) {
      // TTN changed
      historyEntries.push({
        source: "delivery",
        oldStatus: oldDelivery,
        newStatus: oldDelivery,
        message: `ТТН оновлено: ${trackingCode}`,
      });
    } else if (!trackingCode && order.trackingNumber) {
      // TTN removed
      historyEntries.push({
        source: "delivery",
        oldStatus: oldDelivery,
        newStatus: oldDelivery,
        message: "ТТН видалено",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Dimension sync: Payment status
// ---------------------------------------------------------------------------

function syncPaymentStatus(
  keycrmOrder: Record<string, unknown>,
  order: { id: string; paymentStatus: string; total: number; paymentMethod: string },
  updateData: Record<string, unknown>,
  historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }>
) {
  const payments = keycrmOrder.payments as Array<Record<string, unknown>> | undefined;
  const keycrmPaymentStatus = String(keycrmOrder.payment_status || "");

  // Calculate paid/refunded from payments array
  let paidAmount = 0;
  let refundedAmount = 0;
  let hasActivePayment = false;

  if (payments && Array.isArray(payments)) {
    for (const p of payments) {
      const status = String(p.status || "");
      const amount = Number(p.amount || 0) * 100; // UAH → kopiyky

      if (status === "paid" || status === "approved") {
        paidAmount += amount;
        hasActivePayment = true;
      } else if (status === "canceled" || status === "refunded") {
        refundedAmount += amount;
      }
    }
  }

  let newPaymentStatus: string | null = null;
  let message = "";

  if (paidAmount >= order.total) {
    newPaymentStatus = "paid";
    message = `Оплату отримано повністю: ${(paidAmount / 100).toFixed(0)} грн`;
  } else if (paidAmount > 0) {
    newPaymentStatus = "partial_paid";
    message = `Часткову оплату отримано: ${(paidAmount / 100).toFixed(0)} грн`;
  } else if (refundedAmount > 0 && !hasActivePayment) {
    newPaymentStatus = "refunded";
    message = "Кошти повернено";
  } else if (keycrmPaymentStatus === "paid") {
    newPaymentStatus = "paid";
    message = "Оплату отримано";
  } else if (keycrmPaymentStatus === "partially_paid") {
    newPaymentStatus = "partial_paid";
    message = "Часткову оплату отримано";
  } else if (keycrmPaymentStatus === "refunded") {
    newPaymentStatus = "refunded";
    message = "Кошти повернено";
  } else if (keycrmPaymentStatus === "not_paid") {
    // Only override if current status is something unexpected
    if (!["pending", "cod_pending", "awaiting_prepayment", "failed", "prepayment_failed"].includes(order.paymentStatus)) {
      newPaymentStatus = "pending";
      message = "Оплата очікується";
    }
  }

  if (newPaymentStatus && newPaymentStatus !== order.paymentStatus) {
    updateData.paymentStatus = newPaymentStatus;
    historyEntries.push({
      source: "keycrm_webhook",
      oldStatus: order.paymentStatus,
      newStatus: newPaymentStatus,
      message,
    });
  }
}

// ---------------------------------------------------------------------------
// KeyCRM API: fetch order with payments
// ---------------------------------------------------------------------------

async function fetchKeycrmOrder(keycrmOrderId: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");

  if (!apiKey) {
    logger.warn("Webhook: KEYCRM_API_KEY not set");
    return null;
  }

  try {
    const url = `${baseUrl}/order/${keycrmOrderId}?include=payments,status,shipping,delivery`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      logger.warn("Webhook: KeyCRM API fetch failed", { keycrmOrderId, httpStatus: res.status });
      return null;
    }

    const data = await res.json();

    // Debug: log delivery/shipping structure to discover where TTN lives
    const shippingSnap = data.shipping ? summarizeObj(data.shipping) : null;
    const deliverySnap = data.delivery ? summarizeObj(data.delivery) : null;
    const deliveriesSnap = Array.isArray(data.deliveries) && data.deliveries[0] ? summarizeObj(data.deliveries[0]) : null;
    const shipmentsSnap = Array.isArray(data.shipments) && data.shipments[0] ? summarizeObj(data.shipments[0]) : null;

    logger.info("Webhook: KeyCRM API response", {
      keycrmOrderId,
      topKeys: Object.keys(data),
      statusType: typeof data.status,
      statusValue: typeof data.status === "object" ? JSON.stringify(data.status).substring(0, 200) : String(data.status || ""),
      tracking_code: data.tracking_code || null,
      ttn: data.ttn || null,
      shipping: shippingSnap,
      delivery: deliverySnap,
      deliveries0: deliveriesSnap,
      shipments0: shipmentsSnap,
      delivery_tracking_code: data.delivery_tracking_code || null,
      shipping_tracking_code: data.shipping_tracking_code || null,
      deliveryStatus: data.delivery_status || data.shipping_status || null,
      paymentStatus: data.payment_status,
      paymentsCount: Array.isArray(data.payments) ? data.payments.length : 0,
    });

    return data;
  } catch (e) {
    logger.error("Webhook: KeyCRM API error", {
      keycrmOrderId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
