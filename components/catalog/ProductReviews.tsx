"use client";

import { useState, useEffect } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Review {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  displayDate: string | null;
  createdAt: string;
}

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/reviews?productId=${productId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setReviews(d.data); });
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setMessage("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, customerName: name, rating, text }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Відгук відправлено");
        setShowForm(false); setName(""); setText(""); setRating(5);
      } else {
        setMessage(data.error?.message || "Помилка");
      }
    } finally { setSubmitting(false); }
  };

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Відгуки ({reviews.length})</h2>
          {avgRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          Залишити відгук
        </Button>
      </div>

      {message && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 rounded-lg p-4 space-y-3">
          <Input id="reviewName" label="Ваше ім'я *" value={name} onChange={(e) => setName(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Оцінка</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setRating(s)}
                  className="focus:outline-none">
                  <Star className={`h-6 w-6 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Відгук *</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required minLength={10} />
          </div>
          <Button type="submit" loading={submitting} size="sm" className="gap-1">
            <Send className="h-4 w-4" /> Відправити
          </Button>
        </form>
      )}

      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border-b pb-4 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{r.customerName}</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                  ))}
                </div>
                <span className="text-xs text-gray-400">{new Date(r.displayDate || r.createdAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="text-sm text-gray-600">{r.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Поки немає відгуків. Будьте першим!</p>
      )}
    </div>
  );
}
