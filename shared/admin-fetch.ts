/**
 * Обгортка для fetch в адмінці: при 401 редіректить на login (один раз).
 * Захист від redirect loop: якщо вже на login — не редіректити.
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 401 && typeof window !== "undefined") {
    // Не редіректити якщо вже на login (захист від loop)
    if (!window.location.pathname.includes("/admin/login")) {
      window.location.href = "/admin/login?expired=1";
    }
  }
  return res;
}
