"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/shared/money";
import { Package, Truck, CreditCard, Clock } from "lucide-react";

interface OrderStatus {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string | null;
  trackingNumber: string | null;
  customerName: string;
  deliveryCity: string | null;
  deliveryBranchName: string | null;
  deliveryAddress: string | null;
  deliveryMethod: string;
  total: number;
  currency: string;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: Array<{ name: string; sku: string; price: number; quantity: number; lineTotal: number }>;
  statusHistory: Array<{ status: string; message: string | null; createdAt: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Нове замовлення", confirmed: "Підтверджено", processing: "В обробці",
  paid: "Оплачено", partial_paid: "Передплата отримана", shipped: "Відправлено", delivered: "Доставлено",
  completed: "Виконано", cancelled: "Скасовано",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Очікує оплати", awaiting_prepayment: "Очікує передплати", partial_paid: "Передплата отримана", cod_pending: "Оплата при отриманні", paid: "Оплачено", failed: "Помилка оплати", prepayment_failed: "Передплата не завершена", refunded: "Повернено",
};

interface OrderListItem {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
}

export default function OrderStatusPage() {
  const [mode, setMode] = useState<"number" | "name">("number");
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenChecked, setTokenChecked] = useState(false);

  // Auto-load order from token in URL (from email link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token && !tokenChecked) {
      setTokenChecked(true);
      setLoading(true);
      fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setOrder(data.data);
          } else {
            setError(data.error?.message || "Посилання недійсне");
          }
        })
        .catch(() => setError("Помилка з'єднання"))
        .finally(() => setLoading(false));
    }
  }, [tokenChecked]);
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [orderList, setOrderList] = useState<OrderListItem[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setOrder(null); setOrderList([]);

    if (mode === "number") {
      if (!orderNumber.trim() || !phone.trim()) { setError("Заповніть номер та телефон"); setLoading(false); return; }
    } else {
      if (!phone.trim() || !customerName.trim()) { setError("Заповніть телефон та ім'я"); setLoading(false); return; }
    }

    try {
      const body = mode === "number"
        ? { orderNumber: orderNumber.trim(), phone: phone.trim() }
        : { phone: phone.trim(), customerName: customerName.trim(), mode: "phone_name" };

      const res = await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        if (data.data) { setOrder(data.data); }
        if (data.list) { setOrderList(data.list); }
      } else {
        setError(data.error?.message || "Замовлення не знайдено");
      }
    } catch { setError("Помилка з'єднання"); }
    finally { setLoading(false); }
  };

  const selectFromList = (num: string) => {
    setOrderNumber(num);
    setMode("number");
    // Trigger search with this order number
    setOrderList([]);
    setOrder(null);
  };

  const statusColor = (s: string) => {
    if (["paid", "completed", "delivered"].includes(s)) return "text-green-600 bg-green-50";
    if (["cancelled", "failed", "refunded"].includes(s)) return "text-red-600 bg-red-50";
    if (["shipped", "processing", "confirmed"].includes(s)) return "text-blue-600 bg-blue-50";
    return "text-yellow-600 bg-yellow-50";
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Статус замовлення</h1>
      <p className="text-gray-500 mb-4">Перевірте статус вашого замовлення</p>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode("number")} className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === "number" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>За номером замовлення</button>
        <button onClick={() => setMode("name")} className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === "name" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>За телефоном та ім'ям</button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4 mb-8">
        {mode === "number" ? (
          <>
            <Input id="orderNumber" label="Номер замовлення *" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="K-5001" />
            <Input id="phone" label="Телефон *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380 XX XXX XX XX" />
          </>
        ) : (
          <>
            <Input id="phone2" label="Телефон *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380 XX XXX XX XX" />
            <Input id="customerName" label="Ім'я або прізвище *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Прізвище" />
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Знайти замовлення</Button>
      </form>

      {/* Order list from phone+name search */}
      {orderList.length > 0 && !order && (
        <div className="mb-8 bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b"><h2 className="font-semibold">Знайдено замовлень: {orderList.length}</h2></div>
          {orderList.map((o) => (
            <button key={o.orderNumber} onClick={() => selectFromList(o.orderNumber)} className="w-full text-left px-4 py-3 hover:bg-green-50 border-b last:border-0 flex justify-between items-center">
              <div>
                <span className="font-medium">{o.orderNumber}</span>
                <span className="text-gray-400 text-xs ml-2">{new Date(o.createdAt).toLocaleDateString("uk-UA")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatPrice(o.total)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>{STATUS_LABELS[o.status] || o.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Замовлення {order.orderNumber}</h2>
              <span className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("uk-UA")}</span>
            </div>

            {/* Status badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Замовлення</div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Оплата</div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(order.paymentStatus)}`}>
                    {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Доставка</div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(order.deliveryStatus || "pending")}`}>
                    {order.deliveryStatus === "shipped" ? "Відправлено" : order.deliveryStatus === "delivered" ? "Доставлено" : "Очікує"}
                  </span>
                </div>
              </div>
            </div>

            {order.trackingNumber && (
              <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm">
                <span className="text-blue-700 font-medium">Трекінг-номер: </span>
                <span className="font-mono">{order.trackingNumber}</span>
              </div>
            )}
          </div>

          {/* Delivery */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-3">Доставка</h3>
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">Отримувач:</span> {order.customerName}</div>
              <div><span className="text-gray-500">Місто:</span> {order.deliveryCity || "—"}</div>
              <div><span className="text-gray-500">Адреса:</span> {order.deliveryBranchName || order.deliveryAddress || "—"}</div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-3">Товари</h3>
            <div className="divide-y">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between py-2 text-sm">
                  <span>{item.name} &times; {item.quantity}</span>
                  <span className="font-medium">{formatPrice(item.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
              <span>Разом</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Status history */}
          {order.statusHistory.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Історія</h3>
              <div className="space-y-3">
                {order.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{STATUS_LABELS[h.status] || h.status}</div>
                      {h.message && <div className="text-xs text-gray-500">{h.message}</div>}
                      <div className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString("uk-UA")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
