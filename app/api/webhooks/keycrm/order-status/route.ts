import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { createLogger } from "@/shared/logger";
import { mapKeycrmToPublicStatus } from "@/shared/keycrm-status-map";
import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";

const logger = createLogger("KeyCRM:Webhook:OrderStatus");
const ENDPOINT = "/api/webhooks/keycrm/order-status";

/**
 * Production webhook endpoint for KeyCRM.
 * URL configured in KeyCRM:
 *   POST /api/webhooks/keycrm/order-status?secret=KEYCRM_WEBHOOK_SECRET
 *
 * KeyCRM webhook payload structure:
 *   { event: "order.status_changed", context: { id: 3911, ... } }
 *
 * Strategy: use webhook as trigger → fetch full order from KeyCRM API →
 * update local order status/delivery/tracking.
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
    // --- Parse KeyCRM webhook structure: { event, context } ---
    const eventName = String(payload.event || "");
    const context = (payload.context || payload) as Record<string, unknown>;

    // Extract KeyCRM order ID from context
    const keycrmOrderId = extractKeycrmOrderId(context, payload);

    logger.info("KeyCRM webhook received", {
      event: eventName,
      keycrmOrderId,
      contextKeys: context ? Object.keys(context) : [],
    });

    // Log the raw webhook for diagnostics (first N webhooks help debug structure)
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

    // --- Route by event name ---
    const eventType = classifyEvent(eventName);

    switch (eventType) {
      case "order":
        return await handleOrderEvent(keycrmOrderId, eventName);
      case "payment":
        return await handlePaymentEvent(keycrmOrderId, eventName);
      default:
        return await handleUnsupportedEvent(eventName, keycrmOrderId);
    }
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

    // Return 200 to prevent KeyCRM from retrying on our internal errors
    return NextResponse.json({ status: "ok", error: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract KeyCRM order ID from various payload shapes */
function extractKeycrmOrderId(context: Record<string, unknown>, payload: Record<string, unknown>): string {
  // context.id is the most common location
  const id = context?.id || context?.order_id || payload.id || payload.order_id || "";
  return String(id);
}

/** Sanitize payload for logging — remove sensitive fields, trim length */
function sanitizePayloadForLog(payload: Record<string, unknown>): string {
  try {
    const safe = { ...payload };
    // Remove potentially sensitive nested data
    if (safe.context && typeof safe.context === "object") {
      const ctx = { ...(safe.context as Record<string, unknown>) };
      // Keep structure but truncate large nested objects
      for (const key of Object.keys(ctx)) {
        if (typeof ctx[key] === "object" && ctx[key] !== null) {
          const nested = ctx[key] as Record<string, unknown>;
          // Keep id/name/status fields, summarize the rest
          ctx[key] = { _keys: Object.keys(nested), id: nested.id, name: nested.name, status: nested.status };
        }
      }
      safe.context = ctx;
    }
    return JSON.stringify(safe).substring(0, 4000);
  } catch {
    return JSON.stringify({ error: "failed to serialize" });
  }
}

/** Classify event name into a category */
type EventCategory = "order" | "payment" | "unsupported";

function classifyEvent(eventName: string): EventCategory {
  const lower = eventName.toLowerCase();

  // Order events
  if (
    lower.includes("order") ||
    lower.includes("status") ||
    lower.includes("замовлення") ||
    lower === "" // Empty event name — treat as order update (legacy/default)
  ) {
    // Check if it's specifically a payment sub-event on an order
    if (lower.includes("payment") || lower.includes("invoice")) {
      return "payment";
    }
    return "order";
  }

  // Payment events
  if (lower.includes("payment") || lower.includes("invoice") || lower.includes("оплат")) {
    return "payment";
  }

  return "unsupported";
}

// ---------------------------------------------------------------------------
// Order event handler (trigger + fetch from API)
// ---------------------------------------------------------------------------

async function handleOrderEvent(keycrmOrderId: string, eventName: string) {
  if (!keycrmOrderId) {
    logger.warn("Webhook: no order ID in payload", { event: eventName });
    return NextResponse.json({ status: "ok", skipped: true, reason: "no_order_id" });
  }

  // Find local order
  const order = await prisma.order.findFirst({
    where: { keycrmOrderId },
  });

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

  // --- Fetch full order from KeyCRM API ---
  const keycrmOrder = await fetchKeycrmOrder(keycrmOrderId);
  if (!keycrmOrder) {
    logger.warn("Webhook: failed to fetch order from KeyCRM API", { keycrmOrderId });
    return NextResponse.json({ status: "ok", skipped: true, reason: "api_fetch_failed" });
  }

  // --- Extract status, tracking, payment from API response ---
  const statusObj = keycrmOrder.status as Record<string, unknown> | undefined;
  const keycrmStatusName: string = String(statusObj?.name || keycrmOrder.status_name || "");
  const keycrmStatusId: number | undefined = (keycrmOrder.status_id as number) || (statusObj?.id as number);
  const trackingCode: string | null = (keycrmOrder.tracking_code as string) || (keycrmOrder.ttn as string) || null;

  // Map to one of 6 global public statuses
  const newPublicStatus = mapKeycrmToPublicStatus(keycrmStatusId, keycrmStatusName);
  const oldPublicStatus = order.status;

  // Idempotency: skip if same public status AND same KeyCRM sub-status AND same tracking
  if (
    oldPublicStatus === newPublicStatus &&
    order.keycrmStatusName === keycrmStatusName &&
    (order.trackingNumber || null) === trackingCode
  ) {
    logger.info("Webhook: no changes detected, skipping", {
      orderId: order.id,
      status: newPublicStatus,
      keycrmStatus: keycrmStatusName,
    });
    return NextResponse.json({ status: "ok", unchanged: true });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  const historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }> = [];

  // --- Order status change ---
  if (oldPublicStatus !== newPublicStatus || order.keycrmStatusName !== keycrmStatusName) {
    updateData.status = newPublicStatus;
    updateData.keycrmStatusId = keycrmStatusId || null;
    updateData.keycrmStatusName = keycrmStatusName;

    if (oldPublicStatus !== newPublicStatus) {
      const statusLabels: Record<string, string> = {
        new: "Нове", approval: "Погодження", production: "Виробництво",
        delivery: "Доставка", completed: "Виконано", cancelled: "Скасовано",
      };
      historyEntries.push({
        source: "keycrm_webhook",
        oldStatus: oldPublicStatus,
        newStatus: newPublicStatus,
        message: `Статус змінено: ${statusLabels[newPublicStatus] || keycrmStatusName}`,
      });
    }
  }

  // --- Delivery status updates ---
  if (newPublicStatus === "delivery" && order.deliveryStatus !== "shipped") {
    updateData.deliveryStatus = "shipped";
    if (!order.shippedAt) updateData.shippedAt = new Date();
    historyEntries.push({
      source: "delivery",
      oldStatus: order.deliveryStatus || "pending",
      newStatus: "shipped",
      message: trackingCode
        ? `Замовлення передано в доставку. ТТН: ${trackingCode}`
        : "Замовлення передано в доставку",
    });
  }
  if (newPublicStatus === "completed" && order.deliveryStatus !== "delivered") {
    updateData.deliveryStatus = "delivered";
    if (!order.deliveredAt) updateData.deliveredAt = new Date();
    historyEntries.push({
      source: "delivery",
      oldStatus: order.deliveryStatus || "pending",
      newStatus: "delivered",
      message: "Замовлення доставлено",
    });
  }

  // --- Tracking number update ---
  if (trackingCode && trackingCode !== order.trackingNumber) {
    updateData.trackingNumber = trackingCode;
    if (!historyEntries.some((h) => h.message.includes("ТТН"))) {
      historyEntries.push({
        source: "delivery",
        oldStatus: order.deliveryStatus || "pending",
        newStatus: order.deliveryStatus || "pending",
        message: `ТТН: ${trackingCode}`,
      });
    }
  }

  // --- Sync payment status from KeyCRM (if order has payments data) ---
  const paymentSync = syncPaymentStatusFromKeycrmOrder(
    keycrmOrder,
    { paymentStatus: order.paymentStatus, total: order.total, paymentMethod: order.paymentMethod }
  );
  if (paymentSync.newPaymentStatus) {
    updateData.paymentStatus = paymentSync.newPaymentStatus;
    historyEntries.push({
      source: "keycrm_webhook",
      oldStatus: order.paymentStatus,
      newStatus: paymentSync.newPaymentStatus,
      message: paymentSync.message,
    });
  }

  // --- Apply updates ---
  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({ where: { id: order.id }, data: updateData });
  }

  for (const entry of historyEntries) {
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, ...entry },
    });
  }

  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "order",
    entityId: order.id,
    responseStatus: 200,
  });

  logger.info("Webhook: order updated", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    event: eventName,
    oldStatus: oldPublicStatus,
    newStatus: newPublicStatus,
    keycrmStatus: keycrmStatusName,
    trackingCode,
    historyCount: historyEntries.length,
  });

  return NextResponse.json({
    status: "ok",
    updated: Object.keys(updateData).length > 0,
    publicStatus: newPublicStatus,
  });
}

// ---------------------------------------------------------------------------
// Payment event handler
// ---------------------------------------------------------------------------

async function handlePaymentEvent(keycrmOrderId: string, eventName: string) {
  logger.info("Webhook: payment event received", { keycrmOrderId, event: eventName });

  if (!keycrmOrderId) {
    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: ENDPOINT,
      entityType: "payment",
      responseStatus: 200,
    });
    return NextResponse.json({ status: "ok", event: "payment", skipped: true, reason: "no_order_id" });
  }

  const order = await prisma.order.findFirst({ where: { keycrmOrderId } });
  if (!order) {
    await IntegrationLogRepository.create({
      integration: "keycrm",
      direction: "inbound",
      method: "WEBHOOK",
      endpoint: ENDPOINT,
      entityType: "payment",
      entityId: keycrmOrderId,
      errorMessage: "Order not found locally",
    });
    return NextResponse.json({ status: "ok", event: "payment", skipped: true, reason: "order_not_found" });
  }

  const keycrmOrder = await fetchKeycrmOrder(keycrmOrderId);
  if (!keycrmOrder) {
    return NextResponse.json({ status: "ok", event: "payment", skipped: true, reason: "api_fetch_failed" });
  }

  const { newPaymentStatus, paidAmount, message } = syncPaymentStatusFromKeycrmOrder(
    keycrmOrder,
    { paymentStatus: order.paymentStatus, total: order.total, paymentMethod: order.paymentMethod }
  );

  if (newPaymentStatus) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: newPaymentStatus },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        source: "keycrm_webhook",
        oldStatus: order.paymentStatus,
        newStatus: newPaymentStatus,
        message,
      },
    }).catch(() => { /* non-critical */ });

    logger.info("Webhook: payment status synced from KeyCRM", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      oldPaymentStatus: order.paymentStatus,
      newPaymentStatus,
      paidAmount,
      orderTotal: order.total,
    });
  }

  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "payment",
    entityId: order.id,
    responseStatus: 200,
  });

  return NextResponse.json({
    status: "ok",
    event: "payment",
    updated: !!newPaymentStatus,
    paymentStatus: newPaymentStatus || order.paymentStatus,
  });
}

// ---------------------------------------------------------------------------
// Unsupported event handler
// ---------------------------------------------------------------------------

async function handleUnsupportedEvent(eventName: string, keycrmOrderId: string) {
  logger.info("Webhook: unsupported event type", { event: eventName, keycrmOrderId });

  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "unsupported",
    entityId: keycrmOrderId || undefined,
    responseStatus: 200,
  });

  return NextResponse.json({ status: "ok", event: eventName, skipped: true });
}

// ---------------------------------------------------------------------------
// KeyCRM API: fetch order
// ---------------------------------------------------------------------------

async function fetchKeycrmOrder(keycrmOrderId: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");

  if (!apiKey) {
    logger.warn("Webhook: KEYCRM_API_KEY not set, cannot fetch order");
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/order/${keycrmOrderId}?include=payments`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });

    if (!res.ok) {
      logger.warn("Webhook: KeyCRM API fetch failed", { keycrmOrderId, httpStatus: res.status });
      return null;
    }

    return await res.json();
  } catch (e) {
    logger.error("Webhook: KeyCRM API request error", {
      keycrmOrderId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payment status sync from KeyCRM order data
// ---------------------------------------------------------------------------

interface PaymentSyncResult {
  newPaymentStatus: string | null; // null = no change
  paidAmount: number; // in kopiyky
  message: string;
}

/**
 * Calculate the correct paymentStatus from KeyCRM order payments.
 * Returns null newPaymentStatus if no change needed.
 */
function syncPaymentStatusFromKeycrmOrder(
  keycrmOrder: Record<string, unknown>,
  localOrder: { paymentStatus: string; total: number; paymentMethod: string }
): PaymentSyncResult {
  const payments = keycrmOrder.payments as Array<Record<string, unknown>> | undefined;
  const orderTotal = localOrder.total; // in kopiyky

  // Calculate paid/refunded amounts from KeyCRM payments
  let paidAmount = 0; // kopiyky
  let refundedAmount = 0;
  let hasActivePayment = false;

  if (payments && Array.isArray(payments)) {
    for (const p of payments) {
      const status = String(p.status || "");
      const amount = Number(p.amount || 0) * 100; // KeyCRM stores in UAH, we use kopiyky

      if (status === "paid" || status === "approved") {
        paidAmount += amount;
        hasActivePayment = true;
      } else if (status === "canceled" || status === "refunded") {
        refundedAmount += amount;
      }
    }
  }

  // Also check KeyCRM's own payment_status as fallback
  const keycrmPaymentStatus = String(keycrmOrder.payment_status || "");

  let newPaymentStatus: string;
  let message: string;

  if (paidAmount >= orderTotal) {
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
  } else {
    // No active payments — keep current or set to pending
    // Don't override WayForPay-set statuses (cod_pending, awaiting_prepayment) if KeyCRM says "not_paid"
    if (keycrmPaymentStatus === "not_paid" && !["pending", "cod_pending", "awaiting_prepayment", "failed", "prepayment_failed"].includes(localOrder.paymentStatus)) {
      newPaymentStatus = "pending";
      message = "Оплата очікується";
    } else {
      return { newPaymentStatus: null, paidAmount, message: "" };
    }
  }

  // Only return change if status actually differs
  if (newPaymentStatus === localOrder.paymentStatus) {
    return { newPaymentStatus: null, paidAmount, message: "" };
  }

  return { newPaymentStatus, paidAmount, message };
}
