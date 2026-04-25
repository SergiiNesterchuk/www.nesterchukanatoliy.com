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
 * Handles:
 *  - Order status change → maps to 6 global statuses, updates Order + OrderStatusHistory
 *  - Payment/invoice events → logs and returns 200
 *  - Unknown events → logs and returns 200
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
    // --- Detect event type ---
    const eventType = detectEventType(payload);

    logger.info("KeyCRM webhook received", {
      eventType,
      payloadId: payload.id,
      statusId: payload.status_id,
      statusName: (payload.status as Record<string, unknown>)?.name || payload.status_name,
    });

    switch (eventType) {
      case "order_status":
        return await handleOrderStatusChange(payload);
      case "payment":
        return await handlePaymentEvent(payload);
      default:
        return await handleUnknownEvent(payload, eventType);
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
      entityType: "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      requestBody: JSON.stringify(payload).substring(0, 4000),
    });

    // Return 200 to prevent KeyCRM from retrying on our internal errors
    return NextResponse.json({ status: "ok", error: true });
  }
}

// ---------------------------------------------------------------------------
// Event detection
// ---------------------------------------------------------------------------

type WebhookEventType = "order_status" | "payment" | "unknown";

function detectEventType(payload: Record<string, unknown>): WebhookEventType {
  // KeyCRM order status webhook: has status_id or status object with name
  if (
    payload.status_id !== undefined ||
    (payload.status && typeof payload.status === "object" && "name" in (payload.status as object))
  ) {
    // Distinguish order-status from payment-status
    // Payment events typically have amount/payment_status/transaction fields
    if (payload.payment_status !== undefined || payload.transaction_id !== undefined) {
      return "payment";
    }
    return "order_status";
  }

  // Payment-specific payload
  if (
    payload.payment_status !== undefined ||
    payload.amount !== undefined ||
    payload.transaction_id !== undefined ||
    payload.invoice_id !== undefined
  ) {
    return "payment";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Order status change handler
// ---------------------------------------------------------------------------

async function handleOrderStatusChange(payload: Record<string, unknown>) {
  const keycrmOrderId = String(payload.id || payload.order_id || "");
  const statusPayload = payload.status as Record<string, unknown> | undefined;
  const statusId = (payload.status_id as number) || (statusPayload?.id as number);
  const statusName = (statusPayload?.name as string) || (payload.status_name as string) || "";
  const trackingCode = (payload.tracking_code as string) || (payload.ttn as string) || null;

  if (!keycrmOrderId) {
    logger.warn("Webhook: no order ID in payload");
    return NextResponse.json({ status: "ok", skipped: true, reason: "no_order_id" });
  }

  // Find local order
  const order = await prisma.order.findFirst({
    where: { keycrmOrderId },
  });

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
      requestBody: JSON.stringify(payload).substring(0, 4000),
    });
    return NextResponse.json({ status: "ok", skipped: true, reason: "order_not_found" });
  }

  // Map to one of 6 global public statuses
  const newPublicStatus = mapKeycrmToPublicStatus(statusId, statusName);
  const oldPublicStatus = order.status;

  // Idempotency: skip if same public status AND same KeyCRM sub-status
  if (oldPublicStatus === newPublicStatus && order.keycrmStatusName === statusName) {
    logger.info("Webhook: status unchanged, skipping", {
      orderId: order.id,
      status: newPublicStatus,
      keycrmStatus: statusName,
    });
    return NextResponse.json({ status: "ok", unchanged: true });
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    status: newPublicStatus,
    keycrmStatusId: statusId || null,
    keycrmStatusName: statusName,
  };

  const historyEntries: Array<{ source: string; oldStatus: string; newStatus: string; message: string }> = [];

  // Order status change history
  if (oldPublicStatus !== newPublicStatus) {
    const statusLabels: Record<string, string> = {
      new: "Нове", approval: "Погодження", production: "Виробництво",
      delivery: "Доставка", completed: "Виконано", cancelled: "Скасовано",
    };
    const label = statusLabels[newPublicStatus] || statusName;
    historyEntries.push({
      source: "keycrm_webhook",
      oldStatus: oldPublicStatus,
      newStatus: newPublicStatus,
      message: `Статус змінено: ${label}`,
    });
  }

  if (newPublicStatus === "delivery") {
    updateData.deliveryStatus = "shipped";
    if (!order.shippedAt) {
      updateData.shippedAt = new Date();
      historyEntries.push({
        source: "delivery",
        oldStatus: order.deliveryStatus || "pending",
        newStatus: "shipped",
        message: trackingCode
          ? `Замовлення передано в доставку. ТТН: ${trackingCode}`
          : "Замовлення передано в доставку",
      });
    }
  }
  if (newPublicStatus === "completed") {
    updateData.deliveryStatus = "delivered";
    if (!order.deliveredAt) {
      updateData.deliveredAt = new Date();
      historyEntries.push({
        source: "delivery",
        oldStatus: order.deliveryStatus || "pending",
        newStatus: "delivered",
        message: "Замовлення доставлено",
      });
    }
  }
  if (trackingCode && trackingCode !== order.trackingNumber) {
    updateData.trackingNumber = trackingCode;
    // Only add TTN history if not already added by delivery block above
    if (!historyEntries.some((h) => h.message.includes("ТТН"))) {
      historyEntries.push({
        source: "delivery",
        oldStatus: order.deliveryStatus || "pending",
        newStatus: order.deliveryStatus || "pending",
        message: `ТТН: ${trackingCode}`,
      });
    }
  }

  await prisma.order.update({ where: { id: order.id }, data: updateData });

  // Write all history entries
  for (const entry of historyEntries) {
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, ...entry },
    });
  }

  // Integration log
  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "order",
    entityId: order.id,
    responseStatus: 200,
  });

  logger.info("Webhook: order status updated", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    oldStatus: oldPublicStatus,
    newStatus: newPublicStatus,
    keycrmStatus: statusName,
  });

  return NextResponse.json({ status: "ok", updated: true, publicStatus: newPublicStatus });
}

// ---------------------------------------------------------------------------
// Payment event handler
// ---------------------------------------------------------------------------

async function handlePaymentEvent(payload: Record<string, unknown>) {
  const keycrmOrderId = String(payload.id || payload.order_id || "");

  logger.info("Webhook: payment event received", {
    keycrmOrderId,
    paymentStatus: payload.payment_status,
    amount: payload.amount,
  });

  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "payment",
    entityId: keycrmOrderId || undefined,
    responseStatus: 200,
    requestBody: JSON.stringify(payload).substring(0, 4000),
  });

  // If we have enough data, try to update payment status
  if (keycrmOrderId && payload.payment_status) {
    const order = await prisma.order.findFirst({ where: { keycrmOrderId } });
    if (order) {
      const paymentStatusMap: Record<string, string> = {
        paid: "paid",
        partially_paid: "partial_paid",
        not_paid: "pending",
        refunded: "refunded",
        cancelled: "cancelled",
      };
      const paymentHistoryLabels: Record<string, string> = {
        paid: "Замовлення оплачено",
        partial_paid: "Передплату отримано",
        pending: "Оплата очікується",
        refunded: "Кошти повернено",
        cancelled: "Платіж скасовано",
      };
      const mappedStatus = paymentStatusMap[String(payload.payment_status)];
      if (mappedStatus && mappedStatus !== order.paymentStatus) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: mappedStatus },
        });

        // Record payment status change in history
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            source: "payment_callback",
            oldStatus: order.paymentStatus,
            newStatus: mappedStatus,
            message: paymentHistoryLabels[mappedStatus] || `Статус оплати: ${mappedStatus}`,
          },
        }).catch(() => { /* non-critical */ });

        logger.info("Webhook: payment status updated", {
          orderId: order.id,
          oldPaymentStatus: order.paymentStatus,
          newPaymentStatus: mappedStatus,
        });
      }
    }
  }

  return NextResponse.json({ status: "ok", event: "payment", handled: true });
}

// ---------------------------------------------------------------------------
// Unknown event handler
// ---------------------------------------------------------------------------

async function handleUnknownEvent(payload: Record<string, unknown>, eventType: string) {
  logger.info("Webhook: unknown/unsupported event", { eventType, keys: Object.keys(payload) });

  await IntegrationLogRepository.create({
    integration: "keycrm",
    direction: "inbound",
    method: "WEBHOOK",
    endpoint: ENDPOINT,
    entityType: "unknown",
    requestBody: JSON.stringify(payload).substring(0, 4000),
    responseStatus: 200,
  });

  return NextResponse.json({ status: "ok", event: "unknown", skipped: true });
}
