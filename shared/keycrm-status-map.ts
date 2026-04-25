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
 * Known IDs (from production logs, May 2026):
 *   1  = Новий (new)
 *   20 = Прийнято (approval)
 *   5  = Виробництво (production) — needs verification
 *   19 = Доставка / Передано в доставку (delivery) — needs verification
 *   12 = Виконано (completed) — needs verification
 *   8  = Скасовано (cancelled) — needs verification
 *
 * TODO: verify exact names via GET /api/admin/keycrm-statuses after deploy
 */
export const KEYCRM_STATUS_ID_MAP: Record<number, PublicOrderStatus> = {
  1: "new",
  20: "approval",
  5: "production",
  19: "delivery",
  12: "completed",
  8: "cancelled",
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
  statusGroupId?: number,
): PublicOrderStatus | undefined {
  // 1. Exact status_id match
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

  // 3. Status group_id fallback
  if (statusGroupId && KEYCRM_STATUS_GROUP_MAP[statusGroupId]) {
    return KEYCRM_STATUS_GROUP_MAP[statusGroupId];
  }

  // 4. Unknown — return undefined so caller preserves current status
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
