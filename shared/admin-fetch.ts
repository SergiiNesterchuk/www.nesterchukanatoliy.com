/**
 * Обгортка для fetch в адмінці: при 401 редіректить на login.
 * Використовувати замість звичайного fetch() в admin pages.
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/admin/login?expired=1";
  }
  return res;
}
