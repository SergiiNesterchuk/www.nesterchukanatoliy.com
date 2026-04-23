/**
 * Normalize a base URL: trim whitespace, remove trailing slash, validate format.
 * Throws if URL is empty or invalid.
 */
export function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    throw new Error("Base URL is empty. Set NEXT_PUBLIC_SITE_URL environment variable.");
  }

  // Reject URLs with spaces in host/path (would encode as %20)
  if (/\s/.test(trimmed)) {
    throw new Error(`Base URL contains whitespace: "${trimmed}". Fix NEXT_PUBLIC_SITE_URL.`);
  }

  try {
    const parsed = new URL(trimmed);
    // Remove trailing slash from origin+pathname
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    throw new Error(`Invalid base URL: "${trimmed}". Must be a valid URL with protocol.`);
  }
}

/**
 * Build an absolute URL from NEXT_PUBLIC_SITE_URL + path.
 * Normalizes base URL, ensures single slash between base and path, no %20.
 */
export function buildAbsoluteUrl(path: string): string {
  const base = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL || "https://nesterchukanatoliy.com"
  );
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;

  // Final safety check: no encoded spaces in result
  if (url.includes("%20")) {
    throw new Error(`Generated URL contains encoded spaces: ${url}`);
  }

  return url;
}
