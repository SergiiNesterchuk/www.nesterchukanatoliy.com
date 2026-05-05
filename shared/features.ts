/**
 * Centralized feature flags and environment helpers.
 *
 * Server-side: all flags available.
 * Client-side: only NEXT_PUBLIC_* flags available (isStaging, stagingBannerEnabled).
 *
 * Production defaults: if env vars not set, production behavior is preserved.
 */

// --- Environment ---

export const appEnv =
  process.env.APP_ENV ||
  process.env.NEXT_PUBLIC_APP_ENV ||
  "production";

export const isProduction = appEnv === "production";
export const isStaging = appEnv === "staging";
export const isLocal = appEnv === "local";

// --- Payments ---

export type PaymentsMode = "live" | "mock" | "sandbox" | "disabled";

function resolvePaymentsMode(): PaymentsMode {
  const explicit = process.env.PAYMENTS_MODE as PaymentsMode | undefined;
  if (explicit && ["live", "mock", "sandbox", "disabled"].includes(explicit)) {
    return explicit;
  }
  // Legacy: PAYMENTS_ENABLED=false → mock (backward-compatible)
  if (process.env.PAYMENTS_ENABLED === "false") return "mock";
  return "live";
}

export const paymentsMode: PaymentsMode = resolvePaymentsMode();
export const isLivePayments = paymentsMode === "live";
export const isMockPayments = paymentsMode === "mock";
export const isSandboxPayments = paymentsMode === "sandbox";
export const paymentsEnabled = paymentsMode !== "disabled";

// --- CRM ---

export const crmSyncEnabled = process.env.CRM_SYNC_ENABLED !== "false";
export const keycrmStatusSyncEnabled = process.env.KEYCRM_STATUS_SYNC_ENABLED !== "false";

// --- UI ---

export const analyticsEnabled = !isStaging && !isLocal;
export const stagingBannerEnabled = isStaging;
