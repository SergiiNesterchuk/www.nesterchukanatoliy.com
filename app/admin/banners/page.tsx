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
        {HOMEPAGE_KEYS.map((item) => (
          <div key={item.key}>
            {item.key === "homepage_description" ? (
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
        ))}

        <Button onClick={handleSave} loading={saving}>Зберегти</Button>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Зміни з&apos;являться на головній сторінці після перезавантаження.
      </div>
    </div>
  );
}
