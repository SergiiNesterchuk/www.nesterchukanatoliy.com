/**
 * Обгортка для fetch в адмінці.
 * При 401: якщо не на login page — один redirect на login.
 * Повертає response завжди (навіть при 401) щоб caller міг обробити.
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin", // гарантувати передачу cookies
  });

  if (res.status === 401 && typeof window !== "undefined") {
    // Redirect тільки якщо ми НЕ на login і ще не редіректили
    const onLoginPage = window.location.pathname.includes("/admin/login");
    if (!onLoginPage) {
      // Затримка щоб не конфліктувати з іншими fetch
      setTimeout(() => {
        window.location.href = "/admin/login?expired=1";
      }, 100);
    }
  }

  return res;
}
