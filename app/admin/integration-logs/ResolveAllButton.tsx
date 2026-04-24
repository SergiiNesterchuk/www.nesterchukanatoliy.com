"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveAllButton({ count }: { count: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleResolve = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin/integration-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_all" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 text-gray-700 disabled:opacity-50"
    >
      {loading ? "Обробка..." : `Позначити всі помилки як вирішені (${count})`}
    </button>
  );
}
