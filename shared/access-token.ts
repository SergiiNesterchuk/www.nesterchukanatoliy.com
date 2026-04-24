import crypto from "crypto";

/**
 * Generate a cryptographically random access token for order status viewing.
 * Returns both raw token (for URL/email) and hash (for DB storage).
 */
export function generateOrderAccessToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("hex"); // 64 chars
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return { token, hash, expiresAt };
}

/**
 * Hash a raw token for DB lookup.
 */
export function hashAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
