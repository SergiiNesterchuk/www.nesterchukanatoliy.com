"use client";

import { useState } from "react";
import { cn } from "@/shared/cn";

interface Tab {
  id: string;
  label: string;
  content: string;
}

interface ProductTabsProps {
  description: string | null;
}

export function ProductTabs({ description }: ProductTabsProps) {
  const tabs: Tab[] = [
    ...(description
      ? [{ id: "description", label: "Опис", content: description }]
      : []),
    {
      id: "delivery",
      label: "Доставка",
      content:
        "<p>Доставка здійснюється <strong>Новою Поштою</strong> по всій Україні. Термін: 1-3 робочих дні. Вартість доставки — за тарифами Нової Пошти.</p>",
    },
    {
      id: "payment",
      label: "Оплата",
      content:
        "<p>Оплата карткою онлайн (Visa / Mastercard) через захищений платіжний сервіс.</p>",
    },
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "description");

  if (tabs.length === 0) return null;

  const activeContent = tabs.find((t) => t.id === activeTab)?.content ?? "";

  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 transition-colors",
                tab.id === activeTab
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div
        className="py-6 prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600"
        dangerouslySetInnerHTML={{ __html: activeContent }}
      />
    </div>
  );
}
