/**
 * KeyCRM status → site public status mapping.
 * 6 global statuses: new, approval, production, delivery, completed, cancelled
 *
 * Dynamic mapping: fetches statuses from KeyCRM API GET /order/statuses,
 * maps status names to public statuses via keyword matching, caches for 1 hour.
 * No manual status_id maintenance needed — new statuses auto-map by name.
 */

import { createLogger } from "./logger";

const logger = createLogger("KeyCRM:StatusMap");

export type PublicOrderStatus = "new" | "approval" | "production" | "delivery" | "completed" | "cancelled";

// ---------------------------------------------------------------------------
// 1. Manual override map (highest priority, for edge cases)
// ---------------------------------------------------------------------------

/**
 * Manual overrides — use ONLY when auto-mapping by name is wrong.
 * Most status_ids should be resolved dynamically via API + name matching.
 */
export const KEYCRM_STATUS_ID_OVERRIDES: Record<number, PublicOrderStatus> = {
  // Verified from production logs:
  19: "cancelled",  // "Скасовано" — confirmed by manual cancel test, group_id=6
};

// ---------------------------------------------------------------------------
// 2. Name-based keyword rules (used for both dynamic and direct matching)
// ---------------------------------------------------------------------------

const KEYCRM_STATUS_NAME_RULES: Array<{ keywords: string[]; status: PublicOrderStatus }> = [
  {
    keywords: [
      "скасовано", "відмінено", "відмовлено",
      "не оплачено", "не влаштувала ціна", "не влаштувала доставка",
      "не влаштувала", "недозвон", "немає в наявності",
      "incorrect_data", "underbid", "not_available",
      "cancelled", "canceled", "refund",
    ],
    status: "cancelled",
  },
  {
    keywords: [
      "доставка", "доставляється",
      "відправлен", "передано в доставку", "передано у доставку",
      "у дорозі", "в дорозі", "створена накладна",
      "departing",
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
      "manufactured",
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
      "оплачена попередня", "waiting_for_email",
      "approval", "confirm", "accepted", "pending",
    ],
    status: "approval",
  },
  {
    keywords: ["новий", "нове", "новое", "new"],
    status: "new",
  },
];

/** Match a status name to a public status using keyword rules */
function matchNameToPublicStatus(name: string): PublicOrderStatus | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  for (const rule of KEYCRM_STATUS_NAME_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.status;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 3. Dynamic cache — fetched from KeyCRM API
// ---------------------------------------------------------------------------

interface KeycrmStatusEntry {
  id: number;
  name: string;
  mapped: PublicOrderStatus | undefined;
}

let dynamicCache: Record<number, KeycrmStatusEntry> = {};
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let fetchInProgress = false;

/** Refresh dynamic status cache from KeyCRM API */
export async function refreshStatusCache(): Promise<void> {
  const apiKey = process.env.KEYCRM_API_KEY;
  const baseUrl = (process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1").trim().replace(/\/+$/, "");

  if (!apiKey || fetchInProgress) return;
  fetchInProgress = true;

  try {
    // Try known KeyCRM endpoints for statuses list
    const endpoints = ["/order/statuses", "/order/status", "/statuses"];
    let rawStatuses: Array<Record<string, unknown>> | null = null;

    for (const ep of endpoints) {
      try {
        const res = await fetch(`${baseUrl}${ep}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        });
        if (res.ok) {
          const json = await res.json();
          // Response could be { data: [...] } or just [...]
          rawStatuses = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : null;
          if (rawStatuses) {
            logger.info("Status cache: fetched from API", { endpoint: ep, count: rawStatuses.length });
            break;
          }
        }
      } catch { /* try next */ }
    }

    if (!rawStatuses || rawStatuses.length === 0) {
      logger.warn("Status cache: could not fetch statuses from KeyCRM API");
      return;
    }

    // Build cache: map each status name to a public status
    const newCache: Record<number, KeycrmStatusEntry> = {};
    for (const raw of rawStatuses) {
      const id = Number(raw.id);
      const name = String(raw.name || raw.title || "");
      if (!id || !name) continue;

      const mapped = KEYCRM_STATUS_ID_OVERRIDES[id] || matchNameToPublicStatus(name);
      newCache[id] = { id, name, mapped };

      if (!mapped) {
        logger.warn("Status cache: unmapped status", { id, name });
      }
    }

    dynamicCache = newCache;
    cacheTimestamp = Date.now();

    logger.info("Status cache: built", {
      total: Object.keys(newCache).length,
      mapped: Object.values(newCache).filter((e) => e.mapped).length,
      unmapped: Object.values(newCache).filter((e) => !e.mapped).map((e) => `${e.id}:${e.name}`),
    });
  } catch (e) {
    logger.error("Status cache: refresh failed", { error: e instanceof Error ? e.message : String(e) });
  } finally {
    fetchInProgress = false;
  }
}

/** Ensure cache is fresh, refresh if stale */
async function ensureCache(): Promise<void> {
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    await refreshStatusCache();
  }
}

// ---------------------------------------------------------------------------
// 4. Main mapping function
// ---------------------------------------------------------------------------

/**
 * Map a KeyCRM status to one of 6 public statuses.
 *
 * Priority:
 *   1. Manual override (KEYCRM_STATUS_ID_OVERRIDES)
 *   2. Dynamic cache (fetched from API, matched by name)
 *   3. Direct statusName keyword match
 *   4. undefined (unknown — caller preserves current status)
 */
export async function mapKeycrmToPublicStatusAsync(
  statusId?: number,
  statusName?: string,
): Promise<PublicOrderStatus | undefined> {
  // 1. Manual override
  if (statusId && KEYCRM_STATUS_ID_OVERRIDES[statusId]) {
    return KEYCRM_STATUS_ID_OVERRIDES[statusId];
  }

  // 2. Dynamic cache (refresh if stale)
  await ensureCache();
  if (statusId && dynamicCache[statusId]) {
    const entry = dynamicCache[statusId];
    if (entry.mapped) return entry.mapped;
    // Entry exists but unmapped — log
    logger.warn("mapStatus: status in cache but unmapped", { statusId, name: entry.name });
  }

  // 3. Direct name match (for cases where API fetch failed)
  const nameMatch = matchNameToPublicStatus(statusName || "");
  if (nameMatch) return nameMatch;

  // 4. Unknown
  return undefined;
}

/**
 * Synchronous version — uses cached data only, no API call.
 * Use when async is not possible (e.g., in non-async helpers).
 */
export function mapKeycrmToPublicStatus(
  statusId?: number,
  statusName?: string,
  _statusGroupId?: number,
): PublicOrderStatus | undefined {
  // 1. Manual override
  if (statusId && KEYCRM_STATUS_ID_OVERRIDES[statusId]) {
    return KEYCRM_STATUS_ID_OVERRIDES[statusId];
  }

  // 2. Dynamic cache (no refresh — sync only)
  if (statusId && dynamicCache[statusId]?.mapped) {
    return dynamicCache[statusId].mapped;
  }

  // 3. Direct name match
  return matchNameToPublicStatus(statusName || "");
}

// ---------------------------------------------------------------------------
// 5. Labels and helpers
// ---------------------------------------------------------------------------

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

/** Get the full dynamic cache for admin/debug endpoint */
export function getStatusCacheSnapshot(): {
  entries: Record<number, KeycrmStatusEntry>;
  age: number;
  overrides: Record<number, PublicOrderStatus>;
} {
  return {
    entries: { ...dynamicCache },
    age: cacheTimestamp ? Date.now() - cacheTimestamp : -1,
    overrides: KEYCRM_STATUS_ID_OVERRIDES,
  };
}
