"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Setting {
  key: string;
  value: string;
}

const HOMEPAGE_KEYS = [
  { key: "homepage_title", label: "Заголовок Hero", default: "Натуральні продукти" },
  { key: "homepage_title_accent", label: "Акцентний текст", default: "власного виробництва" },
  { key: "homepage_description", label: "Опис Hero", default: "Яблучний оцет без хімії та штучних добавок. Бордоська суміш для захисту саду." },
  { key: "homepage_cta_text", label: "Текст кнопки CTA", default: "Перейти до каталогу" },
  { key: "homepage_cta_link", label: "Посилання CTA", default: "/katalog/" },
  { key: "homepage_products_title", label: "Заголовок секції товарів", default: "Наші товари" },
  { key: "homepage_categories_title", label: "Заголовок секції категорій", default: "Категорії" },
  { key: "_divider_1", label: "--- Сторінка успішної оплати ---", default: "" },
  { key: "checkout_success_title", label: "Заголовок (успішна оплата)", default: "Замовлення прийнято!" },
  { key: "checkout_success_text", label: "Текст (успішна оплата)", default: "Дякуємо за замовлення! Ми зв'яжемось з вами найближчим часом для підтвердження." },
  { key: "checkout_failed_title", label: "Заголовок (помилка оплати)", default: "Оплата не пройшла" },
  { key: "checkout_failed_text", label: "Текст (помилка оплати)", default: "Оплата не була завершена. Ваше замовлення збережено — ви можете спробувати оплатити ще раз або зв'язатися з нами." },
  { key: "checkout_pending_title", label: "Заголовок (очікування)", default: "Очікуємо підтвердження оплати" },
  { key: "checkout_pending_text", label: "Текст (очікування)", default: "Ваше замовлення прийнято. Оплата ще обробляється — ми повідомимо вас коли вона буде підтверджена." },
];

export default function AdminBannersPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const map: Record<string, string> = {};
          (d.data as Setting[]).forEach((s) => { map[s.key] = s.value; });
          setSettings(map);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      for (const item of HOMEPAGE_KEYS) {
        if (item.key.startsWith("_")) continue;
        const value = settings[item.key] ?? item.default;
        await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: item.key, value }),
        });
      }
      setMessage("Збережено");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Головна сторінка</h1>

      {message && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>
      )}

      <div className="bg-white rounded-xl border p-6 space-y-4">
        {HOMEPAGE_KEYS.map((item) => {
          if (item.key.startsWith("_divider")) {
            return <div key={item.key} className="border-t pt-4 mt-4"><h3 className="text-sm font-semibold text-gray-500 uppercase">{item.label.replace(/^-+ | -+$/g, "").trim()}</h3></div>;
          }

          const isTextarea = item.key.includes("description") || item.key.includes("text");
          return (
          <div key={item.key}>
            {isTextarea ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                <textarea
                  value={settings[item.key] ?? item.default}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <Input
                id={item.key}
                label={item.label}
                value={settings[item.key] ?? item.default}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.value })}
              />
            )}
          </div>
        );
        })}

        <Button onClick={handleSave} loading={saving}>Зберегти</Button>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Зміни з&apos;являться на головній сторінці після перезавантаження.
      </div>
    </div>
  );
}
