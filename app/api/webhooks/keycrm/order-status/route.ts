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
    statusId = Number(statusObj.id) || undefined;
  } else if (typeof statusRaw === "string") {
    // status is a string (the status name directly)
    statusName = statusRaw;
    statusType = "string";
  } else if (typeof statusRaw === "number") {
    // status is a number (the status ID directly)
    statusId = statusRaw;
    statusType = "number";
  }

  // Fallback: try top-level fields
  if (!statusName && keycrmOrder.status_name) {
    statusName = String(keycrmOrder.status_name);
  }
  if (!statusId && keycrmOrder.status_id) {
    statusId = Number(keycrmOrder.status_id) || undefined;
  }
  // Also try current_status, workflow_status
  if (!statusName && keycrmOrder.current_status) {
    const cs = keycrmOrder.current_status;
    if (typeof cs === "string") statusName = cs;
    else if (typeof cs === "object" && cs !== null) statusName = String((cs as Record<string, unknown>).name || "");
  }

  // --- Tracking extraction: try multiple paths ---
  const trackingFields: string[] = [];
  let trackingCode: string | null = null;

  const trackingPaths = [
    keycrmOrder.tracking_code,
    keycrmOrder.ttn,
    keycrmOrder.trackingNumber,
    keycrmOrder.tracking_number,
  ];

  // Try nested shipping/delivery objects
  const shipping = keycrmOrder.shipping as Record<string, unknown> | undefined;
  if (shipping && typeof shipping === "object") {
    trackingPaths.push(shipping.tracking_code, shipping.ttn, shipping.tracking_number);
  }
  const delivery = keycrmOrder.delivery as Record<string, unknown> | undefined;
  if (delivery && typeof delivery === "object") {
    trackingPaths.push(delivery.tracking_code, delivery.ttn, delivery.tracking_number);
  }

  // Try deliveries array
  const deliveries = keycrmOrder.deliveries as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(deliveries) && deliveries.length > 0) {
    trackingPaths.push(deliveries[0].tracking_code, deliveries[0].ttn, deliveries[0].tracking_number);
  }

  for (const val of trackingPaths) {
    if (val && typeof val === "string" && val.trim()) {
      trackingCode = val.trim();
      break;
    }
  }

  // Log which tracking-related fields exist
  for (const key of ["tracking_code", "ttn", "trackingNumber", "tracking_number", "shipping", "delivery", "deliveries"]) {
    if (keycrmOrder[key] !== undefined) trackingFields.push(key);
  }

  // --- Payment status ---
  const paymentStatus = String(keycrmOrder.payment_status || "");
  const payments = keycrmOrder.payments as Array<unknown> | undefined;
  const paymentsCount = Array.isArray(payments) ? payments.length : 0;

  return {
    statusId,
    statusName,
    trackingCode,
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
  if (!statusName && !statusId) return;

  const newPublicStatus = mapKeycrmToPublicStatus(statusId, statusName);
  const oldPublicStatus = order.status;

  // Only update if public status or KeyCRM sub-status actually changed
  if (oldPublicStatus === newPublicStatus && order.keycrmStatusName === statusName) return;

  updateData.status = newPublicStatus;
  updateData.keycrmStatusId = statusId || null;
  updateData.keycrmStatusName = statusName;

  if (oldPublicStatus !== newPublicStatus) {
    const statusLabels: Record<string, string> = {
      new: "Нове", approval: "Погодження", production: "Виробництво",
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

function syncDeliveryAndTracking(
  extracted: ExtractedFields,
  order: { id: string; deliveryStatus: string | null; trackingNumber: string | null; shippedAt: Date | null; deliveredAt: Date | null; status: string },
  updateData: Record<string, unknown>,
  historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }>
) {
  // Determine effective new public status (might have been updated above)
  const effectiveStatus = (updateData.status as string) || order.status;

  // Delivery status from order status
  if (effectiveStatus === "delivery" && order.deliveryStatus !== "shipped") {
    updateData.deliveryStatus = "shipped";
    if (!order.shippedAt) updateData.shippedAt = new Date();
  }
  if (effectiveStatus === "completed" && order.deliveryStatus !== "delivered") {
    updateData.deliveryStatus = "delivered";
    if (!order.deliveredAt) updateData.deliveredAt = new Date();
  }

  // Tracking number
  const { trackingCode } = extracted;
  if (trackingCode && trackingCode !== order.trackingNumber) {
    updateData.trackingNumber = trackingCode;

    // If tracking appeared and delivery not yet shipped, mark as shipped
    if (!order.deliveryStatus || order.deliveryStatus === "pending") {
      updateData.deliveryStatus = "shipped";
      if (!order.shippedAt) updateData.shippedAt = new Date();
    }

    historyEntries.push({
      source: "delivery",
      oldStatus: order.deliveryStatus || "pending",
      newStatus: (updateData.deliveryStatus as string) || order.deliveryStatus || "pending",
      message: `Замовлення передано в доставку. ТТН: ${trackingCode}`,
    });
  } else if (updateData.deliveryStatus === "shipped" && !historyEntries.some((h) => h.source === "delivery")) {
    // Status changed to delivery but no tracking — still add delivery history
    historyEntries.push({
      source: "delivery",
      oldStatus: order.deliveryStatus || "pending",
      newStatus: "shipped",
      message: "Замовлення передано в доставку",
    });
  } else if (updateData.deliveryStatus === "delivered" && !historyEntries.some((h) => h.message.includes("доставлено"))) {
    historyEntries.push({
      source: "delivery",
      oldStatus: order.deliveryStatus || "pending",
      newStatus: "delivered",
      message: "Замовлення доставлено",
    });
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
    const url = `${baseUrl}/order/${keycrmOrderId}?include=payments`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      logger.warn("Webhook: KeyCRM API fetch failed", { keycrmOrderId, httpStatus: res.status });
      return null;
    }

    const data = await res.json();

    // Debug: log top-level keys and status shape for diagnostics
    logger.info("Webhook: KeyCRM API response shape", {
      keycrmOrderId,
      topKeys: Object.keys(data),
      statusType: typeof data.status,
      statusValue: typeof data.status === "object" ? JSON.stringify(data.status).substring(0, 200) : String(data.status || ""),
      hasTrackingCode: !!data.tracking_code,
      hasTtn: !!data.ttn,
      hasShipping: !!data.shipping,
      hasDelivery: !!data.delivery,
      hasDeliveries: !!data.deliveries,
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
