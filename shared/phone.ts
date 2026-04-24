/**
 * Normalize Ukrainian phone number to +380XXXXXXXXX format.
 * Accepts: 0993633300, 380993633300, +380993633300, 099-363-33-00, etc.
 */
export function normalizePhoneUA(raw: string): string {
  // Remove everything except digits and leading +
  const cleaned = raw.replace(/[\s\-\(\)]/g, "");
  const digits = cleaned.replace(/[^\d]/g, "");

  // 10 digits starting with 0: 0993633300 → +380993633300
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+38${digits}`;
  }

  // 12 digits starting with 380: 380993633300 → +380993633300
  if (digits.length === 12 && digits.startsWith("380")) {
    return `+${digits}`;
  }

  // 11 digits starting with 80: 80993633300 → +380993633300
  if (digits.length === 11 && digits.startsWith("80")) {
    return `+3${digits}`;
  }

  // 9 digits (without leading 0): 993633300 → +380993633300
  if (digits.length === 9) {
    return `+380${digits}`;
  }

  // Already has + prefix and looks correct
  if (cleaned.startsWith("+") && digits.length === 12) {
    return `+${digits}`;
  }

  // Return as-is with + prefix if we can't normalize
  return cleaned.startsWith("+") ? cleaned : `+${digits}`;
}

/**
 * Format phone for display: +380 XX XXX XX XX
 */
export function formatPhoneUA(phone: string): string {
  const normalized = normalizePhoneUA(phone);
  if (normalized.length !== 13) return normalized; // +380XXXXXXXXX = 13 chars

  return `${normalized.slice(0, 4)} ${normalized.slice(4, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9, 11)} ${normalized.slice(11)}`;
}

/**
 * Validate Ukrainian phone number.
 */
export function isValidPhoneUA(raw: string): boolean {
  const normalized = normalizePhoneUA(raw);
  return /^\+380\d{9}$/.test(normalized);
}
