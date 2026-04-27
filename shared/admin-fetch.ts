/**
 * Простий fetch для адмінки. Передає cookies. Не робить redirect.
 * Кожна admin page сама вирішує що робити при 401.
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, credentials: "same-origin" });
}
