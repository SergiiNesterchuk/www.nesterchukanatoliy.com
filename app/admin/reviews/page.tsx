"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminFetch } from "@/shared/admin-fetch";
import { Star, Check, X, Trash2, Pencil, Plus } from "lucide-react";

interface Review {
  id: string;
  productId: string;
  customerName: string;
  rating: number;
  text: string;
  status: string;
  source: string;
  displayDate: string | null;
  createdAt: string;
  product: { name: string; slug: string };
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", rating: 5, text: "", displayDate: "" });
  const [saving, setSaving] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createProductId, setCreateProductId] = useState("");
  const [createForm, setCreateForm] = useState({ customerName: "", rating: 5, text: "", displayDate: "" });

  const load = (status: string) => {
    setLoading(true);
    adminFetch(`/api/admin/reviews?status=${status}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setReviews(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await adminFetch(`/api/admin/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load(filter);
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Видалити відгук?")) return;
    await adminFetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    load(filter);
  };

  const startEdit = (r: Review) => {
    setEditingId(r.id);
    const dt = r.displayDate || r.createdAt;
    setEditForm({
      customerName: r.customerName,
      rating: r.rating,
      text: r.text,
      displayDate: dt ? new Date(dt).toISOString().slice(0, 16) : "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    await adminFetch(`/api/admin/reviews/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: editForm.customerName,
        rating: editForm.rating,
        text: editForm.text,
        displayDate: editForm.displayDate || null,
      }),
    });
    setSaving(false);
    setEditingId(null);
    load(filter);
  };

  const createReview = async () => {
    if (!createProductId || !createForm.text) return;
    setSaving(true);
    await adminFetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: createProductId,
        customerName: createForm.customerName || "Клієнт",
        rating: createForm.rating,
        text: createForm.text,
        displayDate: createForm.displayDate || null,
      }),
    });
    setSaving(false);
    setShowCreate(false);
    setCreateForm({ customerName: "", rating: 5, text: "", displayDate: "" });
    load(filter);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Відгуки</h1>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)} className="gap-1">
          <Plus className="h-4 w-4" /> Створити відгук
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border p-4 mb-6 space-y-3">
          <h3 className="font-semibold">Новий відгук</h3>
          <Input id="createProductId" label="Product ID *" value={createProductId} onChange={(e) => setCreateProductId(e.target.value)} placeholder="ID товару з БД" />
          <Input id="createName" label="Ім'я автора" value={createForm.customerName} onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Рейтинг</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setCreateForm({ ...createForm, rating: s })}>
                  <Star className={`h-5 w-5 ${s <= createForm.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Текст *</label>
            <textarea value={createForm.text} onChange={(e) => setCreateForm({ ...createForm, text: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата і час відгуку</label>
            <input type="datetime-local" value={createForm.displayDate} onChange={(e) => setCreateForm({ ...createForm, displayDate: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <Button size="sm" loading={saving} onClick={createReview}>Створити</Button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-sm border ${filter === s ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300"}`}>
            {s === "pending" ? "На модерації" : s === "approved" ? "Опубліковані" : "Відхилені"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Завантаження...</div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border p-4">
              {editingId === r.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <Input id={`editName-${r.id}`} label="Ім'я" value={editForm.customerName} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Рейтинг</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} type="button" onClick={() => setEditForm({ ...editForm, rating: s })}>
                          <Star className={`h-5 w-5 ${s <= editForm.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Текст</label>
                    <textarea value={editForm.text} onChange={(e) => setEditForm({ ...editForm, text: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата і час відгуку</label>
                    <input type="datetime-local" value={editForm.displayDate} onChange={(e) => setEditForm({ ...editForm, displayDate: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    <p className="text-xs text-gray-400 mt-1">Ця дата показується на сайті. Можна вказати минулу дату.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={saving} onClick={saveEdit}>Зберегти</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Скасувати</Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{r.customerName}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-4 w-4 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      {r.source === "admin" && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Адмін</span>}
                    </div>
                    <p className="text-sm text-gray-500 mb-1">
                      {r.product.name} • {new Date(r.displayDate || r.createdAt).toLocaleString("uk-UA")}
                    </p>
                    <p className="text-sm text-gray-700">{r.text}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)} title="Редагувати">
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "approved")} title="Опублікувати">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "rejected")} title="Відхилити">
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteReview(r.id)} title="Видалити">
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {reviews.length === 0 && <div className="p-8 text-center text-gray-500">Відгуків немає</div>}
        </div>
      )}
    </div>
  );
}
