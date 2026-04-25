/**
 * KeyCRM status → site public status mapping.
 * 6 global statuses: new, approval, production, delivery, completed, cancelled
 */

export type PublicOrderStatus = "new" | "approval" | "production" | "delivery" | "completed" | "cancelled";

/** Map KeyCRM status_id → public status (if IDs are known) */
export const KEYCRM_STATUS_ID_MAP: Record<number, PublicOrderStatus> = {
  // Populate with actual KeyCRM status IDs when known
  // Example: 1: "new", 2: "approval", 3: "production", etc.
};

/**
 * Map KeyCRM status name keywords → public status (case-insensitive).
 * Order matters: more specific keywords should come first to avoid
 * false matches (e.g. "не оплачено" must match cancelled, not approval).
 */
const KEYCRM_STATUS_NAME_RULES: Array<{ keywords: string[]; status: PublicOrderStatus }> = [
  // --- cancelled (check FIRST — contains words that could partially match other rules) ---
  {
    keywords: [
      "скасовано", "відмінено", "відмовлено",
      "не оплачено", "не влаштувала ціна", "не влаштувала доставка",
      "не влаштувала", "недозвон", "немає в наявності",
      "cancelled", "canceled", "refund",
    ],
    status: "cancelled",
  },
  // --- delivery ---
  {
    keywords: [
      "доставка", "доставляється",
      "відправлен", "передано в доставку", "передано у доставку",
      "у дорозі", "в дорозі", "створена накладна",
      "delivery", "shipped", "transit", "sending",
    ],
    status: "delivery",
  },
  // --- completed ---
  {
    keywords: [
      "виконано", "виконаний",
      "доставлено", "отримано", "завершено",
      "completed", "delivered", "done", "finished",
    ],
    status: "completed",
  },
  // --- production ---
  {
    keywords: [
      "виробництво", "виготов", "виготовлено", "виготовляється",
      "збирається", "передано у виробництво", "передано в виробництво",
      "production", "manufacturing", "assembling",
    ],
    status: "production",
  },
  // --- approval ---
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
  // --- new (last — least specific) ---
  {
    keywords: ["новий", "нове", "новое", "new"],
    status: "new",
  },
];

/**
 * Map a KeyCRM status to one of 6 public statuses.
 * Priority: status_id map → status name keyword match → fallback "new"
 */
export function mapKeycrmToPublicStatus(statusId?: number, statusName?: string): PublicOrderStatus {
  // 1. Try exact ID match
  if (statusId && KEYCRM_STATUS_ID_MAP[statusId]) {
    return KEYCRM_STATUS_ID_MAP[statusId];
  }

  // 2. Try name keyword match (case-insensitive)
  if (statusName) {
    const lower = statusName.toLowerCase();
    for (const rule of KEYCRM_STATUS_NAME_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return rule.status;
      }
    }
  }

  // 3. Fallback
  return "new";
}

/** Human-readable labels for public statuses (Ukrainian) */
export const PUBLIC_STATUS_LABELS: Record<PublicOrderStatus, string> = {
  new: "Нове",
  approval: "Погодження",
  production: "Виробництво",
  delivery: "Доставка",
  completed: "Виконано",
  cancelled: "Скасовано",
};

export function getPublicStatusLabel(status: string): string {
  return PUBLIC_STATUS_LABELS[status as PublicOrderStatus] || status;
}
