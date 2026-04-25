/**
 * Human-readable order status labels (Ukrainian).
 * 6 global statuses + legacy backward compat.
 */
import { PUBLIC_STATUS_LABELS, mapKeycrmToPublicStatus, getPublicStatusLabel } from "./keycrm-status-map";

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

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Очікує оплати",
  awaiting_prepayment: "Очікує передплати",
  partial_paid: "Передплата отримана",
  cod_pending: "Оплата при отриманні",
  paid: "Оплачено",
  failed: "Помилка оплати",
  prepayment_failed: "Передплата не завершена",
  refunded: "Повернено",
  cancelled: "Скасовано",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "Очікує відправки",
  shipped: "Відправлено",
  in_transit: "В дорозі",
  delivered: "Доставлено",
  returned: "Повернено відправнику",
};

/** @deprecated Use mapKeycrmToPublicStatus from keycrm-status-map instead */
export const mapKeycrmStatus = (keycrmStatusName: string): string => {
  return mapKeycrmToPublicStatus(undefined, keycrmStatusName);
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
