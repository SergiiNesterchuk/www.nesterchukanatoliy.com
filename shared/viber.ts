/**
 * Normalize phone number for Viber/tel links.
 * Returns clean +380XXXXXXXXX format.
 */
export function normalizePhoneForLink(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `+38${digits}`;
  if (digits.startsWith("380") && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Build Viber chat URL from phone number.
 * Uses viber://chat for mobile apps, fallback viber.click for web.
 */
export function buildViberUrl(phone: string): string {
  const normalized = normalizePhoneForLink(phone);
  // viber://chat?number= expects + as %2B
  return `viber://chat?number=${encodeURIComponent(normalized)}`;
}

/**
 * Build phone href based on link type.
 */
export function buildPhoneUrl(phone: string, linkType: string): string {
  const normalized = normalizePhoneForLink(phone);
  if (linkType === "viber") return buildViberUrl(phone);
  return `tel:${normalized}`;
}

/**
 * Format phone for display: 093-000-3008
 */
export function formatPhoneDisplay(phone: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  // If starts with 380, show without country code
  const local = clean.startsWith("380") ? `0${clean.substring(3)}` : clean;
  if (local.length === 10) {
    return `${local.substring(0, 3)}-${local.substring(3, 6)}-${local.substring(6, 8)}-${local.substring(8)}`;
  }
  return phone; // return as-is if can't format
}
