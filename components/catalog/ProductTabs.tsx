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
  deliveryText?: string;
  paymentText?: string;
}

export function ProductTabs({ description, deliveryText, paymentText }: ProductTabsProps) {
  const tabs: Tab[] = [];

  if (description) {
    tabs.push({ id: "description", label: "Опис", content: description });
  }
  if (deliveryText) {
    tabs.push({ id: "delivery", label: "Доставка", content: deliveryText });
  }
  if (paymentText) {
    tabs.push({ id: "payment", label: "Оплата", content: paymentText });
  }

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
