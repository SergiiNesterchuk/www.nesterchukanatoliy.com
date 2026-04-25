"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/shared/money";
import { Spinner } from "@/components/ui/Spinner";
import { Package, CreditCard, Truck, Clock, XCircle, ArrowLeft } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";

interface OrderDetail {
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
  prepaymentAmount: number | null;
  currency: string;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: Array<{ name: string; sku: string; price: number; quantity: number; lineTotal: number }>;
  statusHistory: Array<{ status: string; source: string; message: string | null; createdAt: string }>;
}

// -- Order statuses (6 global + legacy) --
const ORDER_LABELS: Record<string, string> = {
  new: "Нове замовлення", approval: "Готується до відправки", production: "Виробництво",
  delivery: "Доставка", completed: "Виконано", cancelled: "Скасовано",
  confirmed: "Підтверджено", processing: "В обробці", paid: "Оплачено",
  shipped: "Відправлено", delivered: "Доставлено",
};

// -- Payment statuses (clear refund vs failed) --
const PAYMENT_LABELS: Record<string, string> = {
  pending: "Очікує оплати", awaiting_prepayment: "Очікує передплати",
  partial_paid: "Передплата отримана", cod_pending: "Оплата при отриманні",
  paid: "Оплачено", failed: "Оплата не пройшла",
  prepayment_failed: "Передплата не пройшла",
  refunded: "Кошти повернено", cancelled: "Платіж скасовано",
};

// -- Delivery statuses --
const DELIVERY_LABELS: Record<string, string> = {
  pending: "Очікує відправки", preparing: "Готується до відправки",
  shipped: "Відправлено", in_transit: "В дорозі",
  arrived: "Прибуло у відділення", delivered: "Доставлено",
  returned: "Повернення", delivery_issue: "Проблема з доставкою",
};

function statusColor(s: string) {
  if (["paid", "completed", "delivered", "partial_paid"].includes(s)) return "text-green-600 bg-green-50";
  if (["cancelled", "failed", "refunded", "prepayment_failed"].includes(s)) return "text-red-600 bg-red-50";
  if (["delivery", "shipped", "production", "processing", "in_transit", "preparing", "arrived"].includes(s)) return "text-blue-600 bg-blue-50";
  if (["delivery_issue", "returned"].includes(s) && !["cancelled", "failed", "refunded", "prepayment_failed"].includes(s)) return "text-orange-600 bg-orange-50";
  return "text-yellow-600 bg-yellow-50";
}

/** Format history message for customer (no internal sources visible) */
function formatHistoryLabel(h: { status: string; source: string; message: string | null }): string {
  if (h.message) return h.message;
  return ORDER_LABELS[h.status] || PAYMENT_LABELS[h.status] || h.status;
}

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderNumber) return;

    const body = token
      ? { token }
      : { orderNumber: decodeURIComponent(orderNumber), phone: "", mode: "token_only" };

    if (!token) {
      setError("Для перегляду замовлення перейдіть за посиланням з email або знайдіть замовлення через форму пошуку.");
      setLoading(false);
      return;
    }

    fetch("/api/order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) setOrder(data.data);
        else setError(data.error?.message || "Замовлення не знайдено");
      })
      .catch(() => setError("Помилка з'єднання"))
      .finally(() => setLoading(false));
  }, [orderNumber, token]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Spinner className="mx-auto mb-4 h-8 w-8" />
        <p className="text-gray-500">Завантаження замовлення...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <XCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-600 mb-4">{error || "Замовлення не знайдено"}</p>
        <Link href="/order-status" className="text-green-600 hover:underline">
          Знайти замовлення →
        </Link>
      </div>
    );
  }

  const prepayUAH = order.prepaymentAmount ? order.prepaymentAmount / 100 : 0;
  const remainingUAH = order.prepaymentAmount ? (order.total - order.prepaymentAmount) / 100 : 0;
  const deliveryStatus = order.deliveryStatus || "pending";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/order-status" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Пошук замовлень
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Замовлення {order.orderNumber}</h1>
          <span className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("uk-UA")}</span>
        </div>

        {/* 3 status blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Статус замовлення</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
                {ORDER_LABELS[order.status] || order.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Оплата</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(order.paymentStatus)}`}>
                {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">Доставка</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(deliveryStatus)}`}>
                {DELIVERY_LABELS[deliveryStatus] || deliveryStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Tracking number + Copy + Nova Poshta link */}
        {order.trackingNumber && (
          <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <strong>ТТН:</strong>
              <span className="font-mono">{order.trackingNumber}</span>
              <CopyButton text={order.trackingNumber} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/^\d{14}$/.test(order.trackingNumber) && (
                <a
                  href={`https://novaposhta.ua/tracking/?cargo_number=${order.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Відстежити
                </a>
              )}
            </div>
          </div>
        )}

        {/* Prepayment info */}
        {prepayUAH > 0 && (
          <div className="mt-4 bg-orange-50 rounded-lg p-3 text-sm text-orange-700">
            Передплата {prepayUAH} грн отримана. Решта при отриманні: {remainingUAH} грн
          </div>
        )}
      </div>

      {/* Delivery */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-semibold mb-3">Доставка</h2>
        <div className="text-sm space-y-1 text-gray-600">
          <div><span className="text-gray-500">Отримувач:</span> {order.customerName}</div>
          {order.deliveryCity && <div><span className="text-gray-500">Місто:</span> {order.deliveryCity}</div>}
          {order.deliveryBranchName && <div><span className="text-gray-500">Адреса:</span> {order.deliveryBranchName}</div>}
          {order.deliveryAddress && <div><span className="text-gray-500">Адреса:</span> {order.deliveryAddress}</div>}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-semibold mb-3">Товари</h2>
        <div className="divide-y">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span className="font-medium">{formatPrice(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
          <span>Разом</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* History */}
      {order.statusHistory.length > 0 && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="font-semibold mb-3">Історія замовлення</h2>
          <div className="space-y-3">
            {order.statusHistory.map((h, i) => (
              <div key={i} className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">{formatHistoryLabel(h)}</div>
                  <div className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString("uk-UA")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link href="/" className="text-sm text-green-600 hover:underline">← Повернутись на сайт</Link>
      </div>
    </div>
  );
}
