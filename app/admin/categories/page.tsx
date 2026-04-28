"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
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
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Немає категорій
                </td>
              </tr>
            )}
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                <td className="px-4 py-3 text-center">{cat._count.products}</td>
                <td className="px-4 py-3 text-center">{cat.sortOrder}</td>
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
