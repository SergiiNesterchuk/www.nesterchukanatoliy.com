/**
 * Customer-facing order status labels (Ukrainian).
 * 3 separate status dimensions: order, payment, delivery.
 */
import { PUBLIC_STATUS_LABELS, mapKeycrmToPublicStatus, getPublicStatusLabel } from "./keycrm-status-map";

// ---------------------------------------------------------------------------
// 1. Order status (6 global from KeyCRM mapping + legacy)
// ---------------------------------------------------------------------------

export const ORDER_STATUS_LABELS: Record<string, string> = {
  ...PUBLIC_STATUS_LABELS,
  // Legacy statuses (backward compat for old orders)
  confirmed: "Підтверджено",
  processing: "В обробці",
  paid: "Оплачено",
  shipped: "Відправлено",
  delivered: "Доставлено",
  returned: "Повернено",
};

// ---------------------------------------------------------------------------
// 2. Payment status — customer-facing, clear distinction between
//    failed (before charge) vs refunded/cancelled (after charge)
// ---------------------------------------------------------------------------

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Очікує оплати",
  awaiting_prepayment: "Очікує передплати",
  partial_paid: "Передплата отримана",
  cod_pending: "Оплата при отриманні",
  paid: "Оплачено",
  failed: "Оплата не пройшла",
  prepayment_failed: "Передплата не пройшла",
  refunded: "Кошти повернено",
  cancelled: "Платіж скасовано",
};

// ---------------------------------------------------------------------------
// 3. Delivery status
// ---------------------------------------------------------------------------

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "Очікує відправки",
  preparing: "Готується до відправки",
  shipped: "Відправлено",
  in_transit: "В дорозі",
  arrived: "Прибуло у відділення",
  delivered: "Доставлено",
  returned: "Повернення",
  delivery_issue: "Проблема з доставкою",
};

// ---------------------------------------------------------------------------
// History event labels — for rendering OrderStatusHistory
// ---------------------------------------------------------------------------

/** Convert a history entry into a human-readable message for customers */
export function formatHistoryMessage(entry: {
  source: string;
  oldStatus?: string | null;
  newStatus: string;
  message?: string | null;
}): string {
  const { source, newStatus, message } = entry;

  // Payment events
  if (source === "payment" || source === "payment_callback") {
    return PAYMENT_HISTORY_LABELS[newStatus] || message || PAYMENT_STATUS_LABELS[newStatus] || newStatus;
  }

  // KeyCRM / cron status changes
  if (source === "keycrm_webhook" || source === "keycrm_cron") {
    const label = ORDER_STATUS_LABELS[newStatus];
    if (label) return `Статус змінено: ${label}`;
    return message || newStatus;
  }

  // Delivery events
  if (source === "delivery") {
    return DELIVERY_HISTORY_LABELS[newStatus] || message || DELIVERY_STATUS_LABELS[newStatus] || newStatus;
  }

  // Local / checkout events — use message directly
  if (message) return message;

  // Fallback: try order status label
  return ORDER_STATUS_LABELS[newStatus] || PAYMENT_STATUS_LABELS[newStatus] || newStatus;
}

const PAYMENT_HISTORY_LABELS: Record<string, string> = {
  paid: "Замовлення оплачено",
  partial_paid: "Передплату отримано",
  failed: "Оплата не пройшла",
  prepayment_failed: "Передплата не пройшла",
  refunded: "Кошти повернено",
  cancelled: "Платіж скасовано",
  cod_pending: "Оплата при отриманні",
};

const DELIVERY_HISTORY_LABELS: Record<string, string> = {
  shipped: "Замовлення відправлено",
  in_transit: "Замовлення в дорозі",
  arrived: "Замовлення прибуло у відділення",
  delivered: "Замовлення доставлено",
  returned: "Замовлення повертається",
  delivery_issue: "Проблема з доставкою",
};

// ---------------------------------------------------------------------------
// Accessor functions
// ---------------------------------------------------------------------------

/** @deprecated Use mapKeycrmToPublicStatus from keycrm-status-map instead */
export const mapKeycrmStatus = (keycrmStatusName: string): string => {
  return mapKeycrmToPublicStatus(undefined, keycrmStatusName) || "new";
};

export function getStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || getPublicStatusLabel(status);
}

export function getPaymentLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

export function getDeliveryLabel(status: string | null): string {
  if (!status) return "Очікує відправки";
  return DELIVERY_STATUS_LABELS[status] || status;
}
