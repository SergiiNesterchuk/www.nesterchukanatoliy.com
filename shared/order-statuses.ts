/**
 * Human-readable order status labels (Ukrainian).
 * Used in customer-facing pages — no internal/technical statuses shown.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Нове замовлення",
  confirmed: "Підтверджено",
  processing: "В обробці",
  paid: "Оплачено",
  shipped: "Відправлено",
  delivered: "Доставлено",
  completed: "Виконано",
  cancelled: "Скасовано",
  returned: "Повернено",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Очікує оплати",
  paid: "Оплачено",
  failed: "Помилка оплати",
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

/**
 * Map KeyCRM status names to local status codes.
 * KeyCRM returns status_id and status name. Map by name for flexibility.
 */
export const KEYCRM_STATUS_MAP: Record<string, string> = {
  // Ukrainian KeyCRM status names → local status
  "Новий": "new",
  "новий": "new",
  "Погодження": "processing",
  "погодження": "processing",
  "В обробці": "processing",
  "Виробництво": "processing",
  "Доставка": "shipped",
  "доставка": "shipped",
  "Відправлено": "shipped",
  "Виконано": "completed",
  "виконано": "completed",
  "Відмінено": "cancelled",
  "відмінено": "cancelled",
  "Скасовано": "cancelled",
  "Повернення": "returned",
};

export function mapKeycrmStatus(keycrmStatusName: string): string {
  return KEYCRM_STATUS_MAP[keycrmStatusName] || "processing";
}

export function getStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function getPaymentLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

export function getDeliveryLabel(status: string | null): string {
  if (!status) return "Очікує відправки";
  return DELIVERY_STATUS_LABELS[status] || status;
}
