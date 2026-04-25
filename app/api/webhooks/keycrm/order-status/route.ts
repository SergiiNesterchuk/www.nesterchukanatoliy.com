import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { createLogger } from "@/shared/logger";
import { mapKeycrmToPublicStatus } from "@/shared/keycrm-status-map";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";

const logger = createLogger("KeyCRM:Webhook");
const ENDPOINT = "/api/webhooks/keycrm/order-status";

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ status: "ok", skipped: true, reason: "invalid_json" });
  }

  try {
    const eventName = String(payload.event || "");
    const context = (payload.context || payload) as Record<string, unknown>;
    const keycrmOrderId = String(context?.id || context?.order_id || context?.model_id || payload.id || payload.order_id || "");

    logger.info("Webhook received", {
      event: eventName,
      keycrmOrderId,
      contextKeys: context ? Object.keys(context) : [],
    });

    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: ENDPOINT,
      entityType: "webhook_raw",
      entityId: keycrmOrderId || undefined,
      responseStatus: 200,
      requestBody: JSON.stringify(payload).substring(0, 4000),
    });

    if (!keycrmOrderId) {
      logger.warn("Webhook: no order ID found", { event: eventName });
      return NextResponse.json({ status: "ok", skipped: true, reason: "no_order_id" });
    }

    return await syncOrderSnapshot(keycrmOrderId, eventName, context);
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
      requestBody: JSON.stringify(payload).substring(0, 4000),
    });
    return NextResponse.json({ status: "ok", error: true });
  }
}

// ---------------------------------------------------------------------------
// Unified snapshot sync
// ---------------------------------------------------------------------------

async function syncOrderSnapshot(keycrmOrderId: string, eventName: string, context: Record<string, unknown>) {
  const order = await prisma.order.findFirst({ where: { keycrmOrderId } });
  if (!order) {
    logger.warn("Webhook: order not found locally", { keycrmOrderId });
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

  // Try to fetch full order from KeyCRM API (with cascading fallback)
  const keycrmOrder = await fetchKeycrmOrder(keycrmOrderId);

  // Build data source: API response if available, otherwise webhook context
  const dataSource = keycrmOrder || context;
  const sourceType = keycrmOrder ? "api" : "context";

  if (!keycrmOrder) {
    logger.info("Webhook: using context fallback (API fetch failed)", {
      keycrmOrderId,
      contextKeys: Object.keys(context),
    });
  }

  // Extract fields
  const extracted = extractOrderFields(dataSource);

  logger.info("Webhook: extracted fields", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    event: eventName,
    source: sourceType,
    keycrmStatusId: extracted.statusId,
    keycrmStatusName: extracted.statusName,
    trackingCode: extracted.trackingCode,
    deliveryStatusRaw: extracted.deliveryStatusRaw,
    keycrmPaymentStatus: extracted.paymentStatus,
    paymentsCount: extracted.paymentsCount,
    rawStatusType: extracted.debug.statusType,
    rawStatusKeys: extracted.debug.statusKeys,
    rawTrackingFields: extracted.debug.trackingFields,
  });

  // Sync each dimension independently
  const updateData: Record<string, unknown> = {};
  const historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }> = [];

  syncOrderStatus(extracted, order, updateData, historyEntries);
  syncDeliveryAndTracking(extracted, order, updateData, historyEntries);
  syncPaymentStatus(dataSource, order, updateData, historyEntries);

  // Apply
  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({ where: { id: order.id }, data: updateData });
  }
  for (const entry of historyEntries) {
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, ...entry } });
  }

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
    source: sourceType,
    updatedFields: Object.keys(updateData),
    historyCount: historyEntries.length,
  });

  return NextResponse.json({ status: "ok", updated, updatedFields: Object.keys(updateData) });
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

interface ExtractedFields {
  statusId: number | undefined;
  statusName: string;
  trackingCode: string | null;
  deliveryStatusRaw: string;
  paymentStatus: string;
  paymentsCount: number;
  debug: { statusType: string; statusKeys: string[]; trackingFields: string[]; };
}

function extractOrderFields(data: Record<string, unknown>): ExtractedFields {
  // --- Status ---
  let statusId: number | undefined;
  let statusName = "";
  const statusRaw = data.status;
  let statusType = typeof statusRaw;
  let statusKeys: string[] = [];

  if (statusRaw && typeof statusRaw === "object" && !Array.isArray(statusRaw)) {
    const obj = statusRaw as Record<string, unknown>;
    statusKeys = Object.keys(obj);
    statusName = String(obj.name || obj.title || obj.label || "");
    const rawId = obj.id;
    if (typeof rawId === "number" && rawId > 0) statusId = rawId;
    else if (typeof rawId === "string" && rawId) statusId = parseInt(rawId, 10) || undefined;
  } else if (typeof statusRaw === "string") {
    statusName = statusRaw;
    statusType = "string";
  } else if (typeof statusRaw === "number") {
    statusId = statusRaw;
    statusType = "number";
  }

  // Fallback top-level fields
  if (!statusName && data.status_name) statusName = String(data.status_name);
  if (!statusId && data.status_id) {
    const sid = data.status_id;
    statusId = typeof sid === "number" ? sid : parseInt(String(sid), 10) || undefined;
  }
  // status_group_id as last resort for ID-based mapping
  if (!statusId && data.status_group_id) {
    const gid = data.status_group_id;
    statusId = typeof gid === "number" ? gid : parseInt(String(gid), 10) || undefined;
  }
  if (!statusName && data.current_status) {
    const cs = data.current_status;
    if (typeof cs === "string") statusName = cs;
    else if (typeof cs === "object" && cs !== null) statusName = String((cs as Record<string, unknown>).name || "");
  }

  // --- Tracking ---
  const trackingFields: string[] = [];
  let trackingCode: string | null = null;

  const trackingPaths: unknown[] = [
    data.tracking_code, data.ttn, data.trackingNumber, data.tracking_number,
    data.delivery_tracking_code, data.shipping_tracking_code,
  ];

  const tryNested = (obj: unknown, label: string) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const o = obj as Record<string, unknown>;
      trackingPaths.push(o.tracking_code, o.ttn, o.tracking_number, o.trackingNumber);
      if (label) trackingFields.push(label);
    }
  };

  tryNested(data.shipping, "shipping");
  tryNested(data.delivery, "delivery");
  if (Array.isArray(data.deliveries) && (data.deliveries as unknown[])[0]) {
    tryNested((data.deliveries as unknown[])[0], "deliveries[0]");
  }
  if (Array.isArray(data.shipments) && (data.shipments as unknown[])[0]) {
    tryNested((data.shipments as unknown[])[0], "shipments[0]");
  }

  for (const val of trackingPaths) {
    if (val && typeof val === "string" && val.trim()) { trackingCode = val.trim(); break; }
  }
  for (const key of ["tracking_code", "ttn", "tracking_number", "delivery_tracking_code", "shipping_tracking_code"]) {
    if (data[key] !== undefined) trackingFields.push(key);
  }

  // --- Delivery status ---
  let deliveryStatusRaw = "";
  const dsPaths: unknown[] = [
    data.delivery_status, data.shipping_status, data.tracking_status, data.current_delivery_status,
  ];
  const tryDeliveryNested = (obj: unknown) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      dsPaths.push((obj as Record<string, unknown>).status);
    }
  };
  tryDeliveryNested(data.shipping);
  tryDeliveryNested(data.delivery);
  if (Array.isArray(data.deliveries) && (data.deliveries as unknown[])[0]) {
    const d0 = (data.deliveries as unknown[])[0] as Record<string, unknown>;
    dsPaths.push(d0.status, d0.delivery_status);
  }
  if (Array.isArray(data.shipments) && (data.shipments as unknown[])[0]) {
    const s0 = (data.shipments as unknown[])[0] as Record<string, unknown>;
    dsPaths.push(s0.status, s0.delivery_status);
  }
  for (const val of dsPaths) {
    if (val && typeof val === "string" && val.trim()) { deliveryStatusRaw = val.trim(); break; }
  }

  // --- Payment ---
  const paymentStatus = String(data.payment_status || "");
  const payments = data.payments as Array<unknown> | undefined;
  const paymentsCount = Array.isArray(payments) ? payments.length : 0;

  return {
    statusId, statusName, trackingCode, deliveryStatusRaw, paymentStatus, paymentsCount,
    debug: { statusType, statusKeys, trackingFields },
  };
}

// ---------------------------------------------------------------------------
// Sync: Order status
// ---------------------------------------------------------------------------

function syncOrderStatus(
  extracted: ExtractedFields,
  order: { id: string; status: string; keycrmStatusName: string | null },
  updateData: Record<string, unknown>,
  historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }>
) {
  const { statusId, statusName } = extracted;
  if (!statusName && !statusId) {
    logger.warn("syncOrderStatus: no status data", { orderId: order.id });
    return;
  }

  const newPublicStatus = mapKeycrmToPublicStatus(statusId, statusName);
  const oldPublicStatus = order.status;

  logger.info("syncOrderStatus: mapping", {
    orderId: order.id,
    keycrmStatusId: statusId,
    keycrmStatusName: statusName,
    mapped: newPublicStatus,
    oldLocal: oldPublicStatus,
    willUpdate: oldPublicStatus !== newPublicStatus || order.keycrmStatusName !== statusName,
  });

  if (oldPublicStatus === newPublicStatus && order.keycrmStatusName === statusName) return;

  updateData.status = newPublicStatus;
  updateData.keycrmStatusId = statusId || null;
  updateData.keycrmStatusName = statusName;

  if (oldPublicStatus !== newPublicStatus) {
    const labels: Record<string, string> = {
      new: "Нове", approval: "Готується до відправки", production: "Виробництво",
      delivery: "Доставка", completed: "Виконано", cancelled: "Скасовано",
    };
    historyEntries.push({
      source: "keycrm_webhook",
      oldStatus: oldPublicStatus,
      newStatus: newPublicStatus,
      message: `Статус змінено: ${labels[newPublicStatus] || statusName}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Sync: Delivery + Tracking
// ---------------------------------------------------------------------------

function mapDeliveryStatus(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const rules: Array<{ keywords: string[]; status: string }> = [
    { keywords: ["доставлено", "отримано", "received", "delivered"], status: "delivered" },
    { keywords: ["прибуло", "очікує отримання", "arrived", "ready for pickup"], status: "arrived" },
    { keywords: ["у дорозі", "в дорозі", "in transit"], status: "in_transit" },
    { keywords: ["відправлен", "передано в доставку", "передано у доставку", "shipped"], status: "shipped" },
    { keywords: ["створена накладна", "створено накладну", "label created"], status: "shipped" },
    { keywords: ["повернення", "повертається", "returned"], status: "returned" },
    { keywords: ["проблема", "не доставлено", "problem", "issue"], status: "delivery_issue" },
    { keywords: ["готується", "preparing", "збирається"], status: "preparing" },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.status;
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

  // 1. Map delivery status from KeyCRM
  const mappedDelivery = mapDeliveryStatus(extracted.deliveryStatusRaw);
  let newDelivery: string | null = null;
  if (mappedDelivery && mappedDelivery !== oldDelivery) newDelivery = mappedDelivery;

  // 2. Infer from order status
  if (!newDelivery) {
    if (effectiveStatus === "delivery" && !["shipped", "in_transit", "arrived"].includes(oldDelivery)) newDelivery = "shipped";
    if (effectiveStatus === "completed" && oldDelivery !== "delivered") newDelivery = "delivered";
  }

  // 3. Tracking
  const { trackingCode } = extracted;
  let trackingChanged = false;
  if (trackingCode && trackingCode !== order.trackingNumber) {
    updateData.trackingNumber = trackingCode;
    trackingChanged = true;
    if (!newDelivery && (oldDelivery === "pending" || !order.deliveryStatus)) newDelivery = "shipped";
  } else if (!trackingCode && order.trackingNumber) {
    updateData.trackingNumber = null;
    trackingChanged = true;
  }

  // 4. Apply delivery status
  if (newDelivery) {
    updateData.deliveryStatus = newDelivery;
    if (newDelivery === "shipped" && !order.shippedAt) updateData.shippedAt = new Date();
    if (newDelivery === "delivered" && !order.deliveredAt) updateData.deliveredAt = new Date();

    let message = DELIVERY_HISTORY_MAP[newDelivery] || `Статус доставки: ${newDelivery}`;
    if (trackingChanged && trackingCode && (newDelivery === "shipped" || newDelivery === "preparing")) {
      message = `Замовлення передано в доставку. ТТН: ${trackingCode}`;
    }
    historyEntries.push({ source: "delivery", oldStatus: oldDelivery, newStatus: newDelivery, message });
  }

  // 5. Tracking-only history
  if (trackingChanged && !newDelivery) {
    if (trackingCode && !order.trackingNumber) {
      historyEntries.push({ source: "delivery", oldStatus: oldDelivery, newStatus: oldDelivery, message: `ТТН додано: ${trackingCode}` });
    } else if (trackingCode && order.trackingNumber && trackingCode !== order.trackingNumber) {
      historyEntries.push({ source: "delivery", oldStatus: oldDelivery, newStatus: oldDelivery, message: `ТТН оновлено: ${trackingCode}` });
    } else if (!trackingCode && order.trackingNumber) {
      historyEntries.push({ source: "delivery", oldStatus: oldDelivery, newStatus: oldDelivery, message: "ТТН видалено" });
    }
  }
}

// ---------------------------------------------------------------------------
// Sync: Payment status
// ---------------------------------------------------------------------------

function syncPaymentStatus(
  data: Record<string, unknown>,
  order: { id: string; paymentStatus: string; total: number; paymentMethod: string },
  updateData: Record<string, unknown>,
  historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }>
) {
  const payments = data.payments as Array<Record<string, unknown>> | undefined;
  const keycrmPaymentStatus = String(data.payment_status || "");

  // Also support payments_total from context
  const paymentsTotal = data.payments_total !== undefined ? Number(data.payments_total) * 100 : 0;

  let paidAmount = 0;
  let refundedAmount = 0;
  let hasActivePayment = false;

  if (payments && Array.isArray(payments)) {
    for (const p of payments) {
      const status = String(p.status || "");
      const amount = Number(p.amount || 0) * 100;
      if (status === "paid" || status === "approved") { paidAmount += amount; hasActivePayment = true; }
      else if (status === "canceled" || status === "refunded") { refundedAmount += amount; }
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
  } else if (keycrmPaymentStatus === "paid" || (paymentsTotal > 0 && paymentsTotal >= order.total / 100)) {
    newPaymentStatus = "paid";
    message = "Оплату отримано";
  } else if (keycrmPaymentStatus === "partially_paid" || (paymentsTotal > 0 && paymentsTotal < order.total / 100)) {
    newPaymentStatus = "partial_paid";
    message = "Часткову оплату отримано";
  } else if (keycrmPaymentStatus === "refunded") {
    newPaymentStatus = "refunded";
    message = "Кошти повернено";
  } else if (keycrmPaymentStatus === "not_paid") {
    if (!["pending", "cod_pending", "awaiting_prepayment", "failed", "prepayment_failed"].includes(order.paymentStatus)) {
      newPaymentStatus = "pending";
      message = "Оплата очікується";
    }
  }

  if (newPaymentStatus && newPaymentStatus !== order.paymentStatus) {
    updateData.paymentStatus = newPaymentStatus;
    historyEntries.push({ source: "keycrm_webhook", oldStatus: order.paymentStatus, newStatus: newPaymentStatus, message });
  }
}

// ---------------------------------------------------------------------------
// KeyCRM API: fetch order with cascading fallback
// ---------------------------------------------------------------------------

async function fetchKeycrmOrder(keycrmOrderId: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");

  if (!apiKey) {
    logger.warn("Webhook: KEYCRM_API_KEY not set");
    return null;
  }

  // Cascading fallback: try includes from most to least, stop on first success
  const attempts = [
    `${baseUrl}/order/${keycrmOrderId}?include=payments`,
    `${baseUrl}/order/${keycrmOrderId}`,
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        logger.info("Webhook: KeyCRM API OK", {
          keycrmOrderId,
          url: url.replace(apiKey, "***"),
          topKeys: Object.keys(data),
          statusType: typeof data.status,
          statusValue: typeof data.status === "object" ? JSON.stringify(data.status).substring(0, 200) : String(data.status || ""),
          tracking_code: data.tracking_code || null,
          ttn: data.ttn || null,
          hasShipping: !!data.shipping,
          hasDelivery: !!data.delivery,
          paymentStatus: data.payment_status,
          paymentsCount: Array.isArray(data.payments) ? data.payments.length : 0,
        });
        return data;
      }

      // Log the failure with response body for diagnostics
      const errorBody = await res.text().catch(() => "");
      logger.warn("Webhook: KeyCRM API attempt failed", {
        keycrmOrderId,
        httpStatus: res.status,
        url: url.replace(apiKey, "***"),
        responseBody: errorBody.substring(0, 500),
      });
    } catch (e) {
      logger.error("Webhook: KeyCRM API network error", {
        keycrmOrderId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  logger.warn("Webhook: all KeyCRM API attempts failed, will use context fallback", { keycrmOrderId });
  return null;
}
