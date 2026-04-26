"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface PaymentMethod {
  id: string;
  key: string;
  title: string;
  description: string | null;
  customerInstruction: string | null;
  checkoutButtonLabel: string | null;
  enabled: boolean;
  requiresOnlinePayment: boolean;
  sortOrder: number;
}

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/payment-methods")
      .then((r) => r.json())
      .then((d) => { if (d.success) setMethods(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, field: string, value: unknown) => {
    setMethods((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  const save = async (method: PaymentMethod) => {
    setSaving(method.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/payment-methods/${method.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: method.title,
          description: method.description,
          customerInstruction: method.customerInstruction,
          checkoutButtonLabel: method.checkoutButtonLabel,
          enabled: method.enabled,
          requiresOnlinePayment: method.requiresOnlinePayment,
          sortOrder: method.sortOrder,
        }),
      });
      const d = await res.json();
      if (d.success) setMessage(`"${method.title}" збережено`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Способи оплати</h1>
      {message && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>}

      <div className="space-y-4">
        {methods.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={m.enabled} onChange={(e) => update(m.id, "enabled", e.target.checked)} className="rounded text-green-600" />
                  <span className="font-semibold text-gray-900">{m.enabled ? "Увімкнено" : "Вимкнено"}</span>
                </label>
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{m.key}</span>
                {m.requiresOnlinePayment && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Онлайн</span>}
                {!m.requiresOnlinePayment && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">При отриманні</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input id={`title-${m.id}`} label="Назва" value={m.title} onChange={(e) => update(m.id, "title", e.target.value)} />
              <Input id={`sortOrder-${m.id}`} label="Порядок" type="number" value={m.sortOrder} onChange={(e) => update(m.id, "sortOrder", parseInt(e.target.value) || 0)} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Опис (показується в checkout)</label>
              <textarea value={m.description || ""} onChange={(e) => update(m.id, "description", e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="mb-4">
              <Input id={`btn-${m.id}`} label="Текст кнопки в checkout" value={m.checkoutButtonLabel || ""} onChange={(e) => update(m.id, "checkoutButtonLabel", e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">Цей текст бачить покупець на кнопці підтвердження. Без змінних.</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Повідомлення на сторін��і успішного замовлення</label>
              <textarea value={m.customerInstruction || ""} onChange={(e) => update(m.id, "customerInstruction", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-gray-400">
                Змінні: {"{orderNumber}"} — номер, {"{totalAmount}"} — сума, {"{paidAmount}"} — оплачено, {"{prepaymentAmount}"} — передплата, {"{remainingAmount}"} �� залишок, {"{paymentMethodTitle}"} — спосіб
              </p>
            </div>

            <Button size="sm" loading={saving === m.id} onClick={() => save(m)}>Зберегти</Button>
          </div>
        ))}
      </div>

      {methods.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          Способи оплати не знайдені. Запустіть seed для створення дефолтних методів.
        </div>
      )}
    </div>
  );
}
