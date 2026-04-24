"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Setting { key: string; value: string; }

const SECTIONS = [
  { title: "Стиль сторінки товару", hint: "Оберіть як виглядає сторінка товару для покупця.", items: [
    { key: "product_page_layout", label: "Layout", type: "select", default: "layout_2", options: ["layout_1", "layout_2", "layout_3", "layout_4", "layout_5"],
      optionLabels: { layout_1: "Класичний: фото зліва, купівля справа", layout_2: "Sticky: фото фіксується, опис скролиться", layout_3: "Лендінг: велике фото + довгий опис", layout_4: "Компактний магазин", layout_5: "Мобільний accordion + sticky buy" } },
  ]},
  { title: "Hero секція", hint: "Вимкніть Hero, якщо хочете, щоб головна одразу починалась із товарів або контентного блоку.", items: [
    { key: "homepage_show_hero", label: "Показувати Hero section", type: "select", default: "true", options: ["true", "false"] },
    { key: "homepage_title", label: "Заголовок", type: "text", default: "Натуральні продукти" },
    { key: "homepage_title_accent", label: "Акцентний текст", type: "text", default: "власного виробництва" },
    { key: "homepage_description", label: "Опис", type: "textarea", default: "Яблучний оцет без хімії та штучних добавок." },
    { key: "homepage_cta_text", label: "Текст кнопки", type: "text", default: "Перейти до каталогу" },
    { key: "homepage_cta_link", label: "Посилання кнопки", type: "text", default: "/katalog/" },
  ]},
  { title: "Секції на головній", items: [
    { key: "homepage_show_categories", label: "Показувати категорії", type: "select", default: "true", options: ["true", "false"] },
    { key: "homepage_categories_title", label: "Заголовок категорій", type: "text", default: "Категорії" },
    { key: "homepage_show_products", label: "Показувати товари", type: "select", default: "true", options: ["true", "false"] },
    { key: "homepage_products_title", label: "Заголовок товарів", type: "text", default: "Наші товари" },
    { key: "homepage_show_pages", label: "Показувати сторінки (displayOnHome)", type: "select", default: "false", options: ["true", "false"] },
  ]},
  { title: "HTML-блок на головній", items: [
    { key: "homepage_content_block_position", label: "Позиція блоку", type: "select", default: "after_hero", options: ["after_hero", "after_categories", "after_products"] },
    { key: "homepage_content_block", label: "HTML контент", type: "html", default: "" },
  ]},
  { title: "Футер", items: [
    { key: "footer_brand_title", label: "Назва у футері", type: "text", default: "Магазин Анатолія Нестерчука" },
    { key: "footer_brand_description", label: "Опис у футері", type: "textarea", default: "Натуральний яблучний оцет власного виробництва та засоби для захисту саду." },
    { key: "footer_show_social", label: "Показувати соцмережі", type: "select", default: "true", options: ["true", "false"] },
    { key: "footer_show_contacts", label: "Показувати контакти", type: "select", default: "true", options: ["true", "false"] },
    { key: "footer_show_customer_links", label: "Показувати блок Покупцям", type: "select", default: "true", options: ["true", "false"] },
    { key: "footer_copyright_text", label: "Текст copyright (порожній = авто)", type: "text", default: "" },
    { key: "footer_phone", label: "Телефон у футері", type: "text", default: "093-000-3008" },
    { key: "footer_email", label: "Email у футері", type: "text", default: "marina.onof38@gmail.com" },
    { key: "footer_address", label: "Адреса у футері", type: "text", default: "м. Бровари, Київська обл." },
  ]},
  { title: "Соцмережі", items: [
    { key: "social_instagram", label: "Instagram URL", type: "text", default: "" },
    { key: "social_youtube", label: "YouTube URL", type: "text", default: "" },
    { key: "social_facebook", label: "Facebook URL", type: "text", default: "" },
    { key: "social_tiktok", label: "TikTok URL", type: "text", default: "" },
  ]},
  { title: "Checkout налаштування", items: [
    { key: "checkout_require_terms", label: "Вимагати згоду з умовами", type: "select", default: "true", options: ["true", "false"] },
  ]},
  { title: "Сторінка оплати", items: [
    { key: "checkout_success_title", label: "Заголовок (успіх)", type: "text", default: "Замовлення прийнято!" },
    { key: "checkout_success_text", label: "Текст (успіх)", type: "textarea", default: "Дякуємо за замовлення!" },
    { key: "checkout_failed_title", label: "Заголовок (помилка)", type: "text", default: "Оплата не пройшла" },
    { key: "checkout_failed_text", label: "Текст (помилка)", type: "textarea", default: "Оплата не була завершена." },
  ]},
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

  const update = (key: string, value: string) => setSettings((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      for (const section of SECTIONS) {
        for (const item of section.items) {
          const value = settings[item.key] ?? item.default;
          await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: item.key, value }),
          });
        }
      }
      setMessage("Збережено");
    } catch {
      setMessage("Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Головна сторінка та контент</h1>
      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm border ${message === "Збережено" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message}
        </div>
      )}
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{section.title}</h2>
            {(section as { hint?: string }).hint && <p className="text-xs text-gray-400 mb-4">{(section as { hint?: string }).hint}</p>}
            <div className="space-y-4">
              {section.items.map((item) => {
                const value = settings[item.key] ?? item.default;
                if (item.type === "select" && "options" in item) {
                  return (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                      <select value={value} onChange={(e) => update(item.key, e.target.value)} className="w-full md:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                        {(item.options as string[]).map((o) => {
                          const labels = (item as { optionLabels?: Record<string, string> }).optionLabels;
                          const label = labels?.[o] || (o === "true" ? "Так" : o === "false" ? "Ні" : o === "after_hero" ? "Після hero" : o === "after_categories" ? "Після категорій" : o === "after_products" ? "Після товарів" : o);
                          return <option key={o} value={o}>{label}</option>;
                        })}
                      </select>
                    </div>
                  );
                }
                if (item.type === "textarea") {
                  return (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                      <textarea value={value} onChange={(e) => update(item.key, e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                  );
                }
                if (item.type === "html") {
                  return (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                      <textarea value={value} onChange={(e) => update(item.key, e.target.value)} rows={20} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" placeholder="HTML-код..." />
                      <p className="mt-1 text-xs text-gray-400">Дозволено: section, div, h1-h6, p, ul, ol, li, a, img, strong, em, style. Заборонено: script, iframe.</p>
                    </div>
                  );
                }
                return <Input key={item.key} id={item.key} label={item.label} value={value} onChange={(e) => update(item.key, e.target.value)} />;
              })}
            </div>
          </div>
        ))}
        <Button onClick={handleSave} loading={saving} size="lg">Зберегти все</Button>
      </div>
    </div>
  );
}
