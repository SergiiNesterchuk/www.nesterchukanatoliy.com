"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function SyncFromProductionButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    if (!confirm("Синхронізувати всі товари, категорії, сторінки та налаштування з основного сайту?\n\nЦе замінить поточні дані на тестовому сайті.")) return;

    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/sync-from-production", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();

      if (data.success) {
        const c = data.data;
        setResult(`Синхронізовано: ${c.categories} категорій, ${c.products} товарів, ${c.images} фото, ${c.pages} сторінок, ${c.blogPosts} статей, ${c.settings} налаштувань, ${c.reviews} відгуків`);
      } else {
        setResult(`Помилка: ${data.error || "невідома"}`);
      }
    } catch {
      setResult("Помилка з'єднання");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-amber-800">Тестовий сайт</h3>
          <p className="text-sm text-amber-600 mt-0.5">
            Скопіювати товари, категорії, налаштування з основного сайту
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Синхронізація..." : "Синхронізувати"}
        </button>
      </div>
      {result && (
        <p className={`mt-3 text-sm ${result.startsWith("Помилка") ? "text-red-600" : "text-green-700"}`}>
          {result}
        </p>
      )}
    </div>
  );
}
