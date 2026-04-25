/**
 * KeyCRM status → site public status mapping.
 * 6 global statuses: new, approval, production, delivery, completed, cancelled
 */

export type PublicOrderStatus = "new" | "approval" | "production" | "delivery" | "completed" | "cancelled";

/**
 * Map KeyCRM status_id → public status.
 * Populated from actual KeyCRM status IDs observed in production webhook logs.
 *
 * To discover new IDs: check Railway logs for "syncOrderStatus: mapping"
 * or use GET /api/admin/keycrm-statuses to fetch the full list.
 *
 * Known IDs (from production webhook logs, verified empirically):
 *   1  = Новий (new)                        — group 1
 *   20 = Прийнято (approval)                — group 2
 *   5  = Виробництво (production)           — group 3
 *   8  = Передано в доставку (delivery)     — group 4, confirmed by TTN test
 *   9  = delivery sub-status                — group 4, from production logs
 *   11 = delivery sub-status                — group 4, from production logs
 *   19 = Доставка (delivery)                — group 4
 *   12 = Виконано (completed)               — group 5
 *
 * Cancelled: status_id NOT YET KNOWN — do NOT guess.
 * When a real cancellation is tested, add the correct ID here.
 * Until then, cancelled is matched only by status name keywords or group 6.
 *
 * NOTE: status_group_id is UNRELIABLE — one group can contain both
 * delivery AND cancellation sub-statuses. Use exact status_id mapping.
 *
 * To discover all IDs: GET /api/admin/keycrm-statuses
 */
export const KEYCRM_STATUS_ID_MAP: Record<number, PublicOrderStatus> = {
  1: "new",
  20: "approval",
  5: "production",
  8: "delivery",    // Передано в доставку — group 4
  9: "delivery",    // delivery sub-status — group 4
  11: "delivery",   // delivery sub-status — group 4
  19: "delivery",   // Доставка — group 4
  12: "completed",
  // cancelled: ID unknown — mapped via name keywords or status_group_id=6
};

/**
 * Map KeyCRM status_group_id → public status (fallback when status_id not mapped).
 * KeyCRM groups statuses into groups; group IDs are more stable than status IDs.
 * These are best-guess defaults — verify via admin endpoint.
 */
export const KEYCRM_STATUS_GROUP_MAP: Record<number, PublicOrderStatus> = {
  // Common KeyCRM status group IDs (may vary per account)
  1: "new",
  2: "approval",
  3: "production",
  4: "delivery",
  5: "completed",
  6: "cancelled",
};

/**
 * Map KeyCRM status name keywords → public status (case-insensitive).
 * Order matters: more specific keywords first to avoid false matches.
 */
const KEYCRM_STATUS_NAME_RULES: Array<{ keywords: string[]; status: PublicOrderStatus }> = [
  {
    keywords: [
      "скасовано", "відмінено", "відмовлено",
      "не оплачено", "не влаштувала ціна", "не влаштувала доставка",
      "не влаштувала", "недозвон", "немає в наявності",
      "cancelled", "canceled", "refund",
    ],
    status: "cancelled",
  },
  {
    keywords: [
      "доставка", "доставляється",
      "відправлен", "передано в доставку", "передано у доставку",
      "у дорозі", "в дорозі", "створена накладна",
      "delivery", "shipped", "transit", "sending",
    ],
    status: "delivery",
  },
  {
    keywords: [
      "виконано", "виконаний",
      "доставлено", "отримано", "завершено",
      "completed", "delivered", "done", "finished",
    ],
    status: "completed",
  },
  {
    keywords: [
      "виробництво", "виготов", "виготовлено", "виготовляється",
      "збирається", "передано у виробництво", "передано в виробництво",
      "production", "manufacturing", "assembling",
    ],
    status: "production",
  },
  {
    keywords: [
      "погодження", "прийнято", "прийнятий",
      "очікування", "узгодження",
      "підтверджен", "підтверджено",
      "очікування оплати", "очікує оплати",
      "approval", "confirm", "accepted", "pending",
    ],
    status: "approval",
  },
  {
    keywords: ["новий", "нове", "новое", "new"],
    status: "new",
  },
];

/**
 * Map a KeyCRM status to one of 6 public statuses.
 * Priority: status_id → status name keywords → status_group_id → undefined (no change)
 *
 * Returns undefined if status cannot be determined — caller should NOT change order.status.
 */
export function mapKeycrmToPublicStatus(
  statusId?: number,
  statusName?: string,
  _statusGroupId?: number,
): PublicOrderStatus | undefined {
  // 1. Exact status_id match — PRIMARY and most reliable source
  if (statusId && KEYCRM_STATUS_ID_MAP[statusId]) {
    return KEYCRM_STATUS_ID_MAP[statusId];
  }

  // 2. Status name keyword match
  if (statusName) {
    const lower = statusName.toLowerCase();
    for (const rule of KEYCRM_STATUS_NAME_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return rule.status;
      }
    }
  }

  // 3. status_group_id is NOT used as fallback — it's unreliable because
  // one group can contain both delivery AND cancellation sub-statuses.
  // Unknown status_id → return undefined → caller preserves current status.
  return undefined;
}

/** Human-readable labels for public statuses (Ukrainian) */
export const PUBLIC_STATUS_LABELS: Record<PublicOrderStatus, string> = {
  new: "Нове",
  approval: "Готується до відправки",
  production: "Виробництво",
  delivery: "Доставка",
  completed: "Виконано",
  cancelled: "Скасовано",
};

export function getPublicStatusLabel(status: string): string {
  return PUBLIC_STATUS_LABELS[status as PublicOrderStatus] || status;
}
