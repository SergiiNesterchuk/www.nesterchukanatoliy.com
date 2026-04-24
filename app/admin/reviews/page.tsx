"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Star, Check, X, Trash2 } from "lucide-react";

interface Review {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  status: string;
  source: string;
  createdAt: string;
  product: { name: string; slug: string };
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = (status: string) => {
    setLoading(true);
    fetch(`/api/admin/reviews?status=${status}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setReviews(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load(filter);
  };

  const deleteReview = async (id: string) => {
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    load(filter);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Відгуки</h1>

      <div className="flex gap-2 mb-4">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === s ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300"}`}>
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
                    {r.product.name} • {new Date(r.createdAt).toLocaleDateString("uk-UA")}
                  </p>
                  <p className="text-sm text-gray-700">{r.text}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
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
            </div>
          ))}
          {reviews.length === 0 && <div className="p-8 text-center text-gray-500">Відгуків немає</div>}
        </div>
      )}
    </div>
  );
}
