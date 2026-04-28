"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [orderChanged, setOrderChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // DnD state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch {
      setError("Не вдалося завантажити категорії");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleToggleActive = async (cat: Category) => {
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
        );
      }
    } catch {
      setError("Не вдалося змінити статус");
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Видалити категорію "${cat.name}"? Це можливо тільки якщо в ній немає товарів.`)) return;
    setDeleting(cat.id);
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      } else {
        setError(data.error?.message || "Не вдалося видалити");
      }
    } catch {
      setError("Не вдалося видалити");
    } finally {
      setDeleting(null);
    }
  };

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
    const newList = [...categories];
    const [moved] = newList.splice(dragIdx.current, 1);
    newList.splice(idx, 0, moved);
    setCategories(newList);
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
    if (swapIdx < 0 || swapIdx >= categories.length) return;
    const newList = [...categories];
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setCategories(newList);
    setOrderChanged(true);
    setSuccessMsg("");
  };

  const saveOrder = async () => {
    setSaving(true);
    setError("");
    try {
      const items = categories.map((cat, i) => ({ id: cat.id, sortOrder: (i + 1) * 10 }));
      const res = await fetch("/api/admin/categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderChanged(false);
        setSuccessMsg("Порядок збережено");
        setCategories((prev) => prev.map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 })));
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Категорії</h1>
        <p className="text-gray-500">Завантаження...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Категорії</h1>
        <Link href="/admin/categories/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Додати категорію
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Назва</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Товарів</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Порядок</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Активна</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Немає категорій
                </td>
              </tr>
            )}
            {categories.map((cat, idx) => (
              <tr
                key={cat.id}
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
                      <button type="button" onClick={() => moveItem(idx, "down")} disabled={idx === categories.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none">&#9660;</button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                <td className="px-4 py-3 text-center">{cat._count.products}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-400">{cat.sortOrder}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(cat)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      cat.isActive
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {cat.isActive ? "Так" : "Ні"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/categories/${cat.id}`}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                      title="Редагувати"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deleting === cat.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      title="Видалити"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
