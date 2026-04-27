/**
 * Fetch для адмінки з credentials і без кешу.
 * cache: "no-store" обходить кешовані 308 redirects з trailingSlash.
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, credentials: "same-origin", cache: "no-store" });
}
