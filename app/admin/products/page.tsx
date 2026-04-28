"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/shared/money";

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number | null;
  stockStatus: string;
  sortOrder: number;
  category: { id: string; name: string };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderChanged, setOrderChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // DnD state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.data);
      })
      .catch(() => setError("Не вдалося завантажити товари"))
      .finally(() => setLoading(false));
  }, []);

  // Drag handlers
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx.current === null || dragIdx.current === idx) {
      setDragOverIdx(null);
      return;
    }
    const newList = [...products];
    const [moved] = newList.splice(dragIdx.current, 1);
    newList.splice(idx, 0, moved);
    setProducts(newList);
    setOrderChanged(true);
    setSuccessMsg("");
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  // Move up/down (mobile fallback)
  const moveItem = (idx: number, dir: "up" | "down") => {
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= products.length) return;
    const newList = [...products];
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setProducts(newList);
    setOrderChanged(true);
    setSuccessMsg("");
  };

  const saveOrder = async () => {
    setSaving(true);
    setError("");
    try {
      const items = products.map((p, i) => ({ id: p.id, sortOrder: (i + 1) * 10 }));
      const res = await fetch("/api/admin/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderChanged(false);
        setSuccessMsg("Порядок збережено");
        setProducts((prev) => prev.map((p, i) => ({ ...p, sortOrder: (i + 1) * 10 })));
      } else {
        setError(data.error?.message || "Не вдалося зберегти порядок");
      }
    } catch {
      setError("Не вдалося зберегти порядок");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Товари</h1>
        <p className="text-gray-500">Завантаження...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Товари</h1>
        <Link href="/admin/products/new">
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Додати товар
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">Закрити</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {orderChanged && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <span className="text-sm text-amber-800">Є незбережені зміни порядку</span>
          <Button size="sm" onClick={saveOrder} loading={saving} disabled={saving}>
            Зберегти порядок
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-10 px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Назва</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Категорія</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Ціна</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Кількість</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Порядок</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Товарів немає
                </td>
              </tr>
            )}
            {products.map((product, idx) => (
              <tr
                key={product.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`hover:bg-gray-50 ${dragOverIdx === idx ? "bg-green-50 border-t-2 border-green-400" : ""}`}
              >
                <td className="px-2 py-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <GripVertical className="h-4 w-4 text-gray-400 cursor-grab active:cursor-grabbing" />
                    <div className="flex flex-col md:hidden">
                      <button type="button" onClick={() => moveItem(idx, "up")} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none">&#9650;</button>
                      <button type="button" onClick={() => moveItem(idx, "down")} disabled={idx === products.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none">&#9660;</button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{product.sku}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-medium text-gray-900 hover:text-green-600"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{product.category.name}</td>
                <td className="px-4 py-3 text-right font-medium">{formatPrice(product.price)}</td>
                <td className="px-4 py-3 text-center">{product.quantity ?? "—"}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-400">{product.sortOrder}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.stockStatus === "in_stock"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {product.stockStatus === "in_stock" ? "В наявності" : "Немає"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
