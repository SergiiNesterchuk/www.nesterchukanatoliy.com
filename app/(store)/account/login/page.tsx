"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show auth error from query if redirected from error page
  const [authError] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err === "Verification") return "Посилання для входу застаріло. Спробуйте ще раз.";
      if (err === "OAuthCallback") return "Помилка входу через Google. Спробуйте ще раз.";
      if (err) return `Помилка входу: ${err}`;
    }
    return "";
  });

  const handleGoogle = () => signIn("google", { callbackUrl: "/account/orders" });

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await signIn("resend", { email, callbackUrl: "/account/orders", redirect: false });
    setEmailSent(true);
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Mail className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Перевірте пошту</h1>
        <p className="text-gray-500">Ми надіслали посилання для входу на <strong>{email}</strong>. Натисніть посилання в листі, щоб увійти.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Особистий кабінет</h1>
      <p className="text-gray-500 text-center mb-8">Увійдіть, щоб переглядати свої замовлення</p>

      {authError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700 text-center">
          {authError}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Увійти через Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-4 text-sm text-gray-400">або</span></div>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <Input id="loginEmail" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
          <Button type="submit" loading={loading} className="w-full">
            Надіслати посилання для входу
          </Button>
        </form>

        <p className="text-xs text-gray-400 text-center">Пароль не потрібен. Ви отримаєте одноразове посилання на email.</p>
      </div>
    </div>
  );
}
