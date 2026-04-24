"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/shared/money";
import { ORDER_STATUSES, PAYMENT_STATUSES, CRM_SYNC_STATUSES } from "@/shared/constants";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryMethod: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryBranchRef: string | null;
  deliveryBranchName: string | null;
  comment: string | null;
  subtotal: number;
  discountTotal: number;
  deliveryCost: number;
  total: number;
  paymentStatus: string;
  paymentProvider: string | null;
  externalPaymentId: string | null;
  keycrmOrderId: string | null;
  keycrmSyncStatus: string;
  keycrmSyncError: string | null;
  keycrmSyncRetries: number;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    eventType: string;
    externalId: string | null;
    amount: number;
    signatureValid: boolean;
    createdAt: string;
  }>;
  integrationLogs: Array<{
    id: string;
    integration: string;
    method: string;
    endpoint: string;
    responseStatus: number | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setOrder(d.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const retrySync = async () => {
    setRetrying(true);
    try {
      await fetch(`/api/admin/orders/${id}/retry-sync`, { method: "POST" });
      const res = await fetch(`/api/admin/orders/${id}`);
      const d = await res.json();
      if (d.success) setOrder(d.data);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;
  if (!order) return <div className="p-8 text-center text-gray-500">Замовлення не знайдено</div>;

  const statusBadge = (value: string, map: Record<string, string>, color: string) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {map[value] || value}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">&larr; Назад</button>
          <h1 className="text-2xl font-bold text-gray-900">Замовлення {order.orderNumber}</h1>
        </div>
        <div className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString("uk-UA")}</div>
      </div>

      {/* Statuses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500 mb-1">Статус</div>
          {statusBadge(order.status, ORDER_STATUSES, "bg-gray-100 text-gray-800")}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500 mb-1">Оплата</div>
          {statusBadge(order.paymentStatus, PAYMENT_STATUSES,
            order.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
            order.paymentStatus === "failed" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
          )}
          {order.externalPaymentId && <div className="text-xs text-gray-400 mt-1">ID: {order.externalPaymentId}</div>}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500 mb-1">CRM Sync</div>
          {statusBadge(order.keycrmSyncStatus, CRM_SYNC_STATUSES,
            order.keycrmSyncStatus === "synced" ? "bg-green-100 text-green-800" :
            order.keycrmSyncStatus === "failed" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
          )}
          {order.keycrmOrderId && <div className="text-xs text-gray-400 mt-1">CRM ID: {order.keycrmOrderId}</div>}
          {order.keycrmSyncError && <div className="text-xs text-red-500 mt-1">{order.keycrmSyncError}</div>}
          {(order.keycrmSyncStatus === "pending" || order.keycrmSyncStatus === "failed") && (
            <Button size="sm" variant="outline" className="mt-2" loading={retrying} onClick={retrySync}>
              Retry sync
            </Button>
          )}
        </div>
      </div>

      {/* Customer & Delivery */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Клієнт та доставка</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Ім'я:</span> {order.customerName}</div>
          <div><span className="text-gray-500">Телефон:</span> {order.customerPhone}</div>
          <div><span className="text-gray-500">Email:</span> {order.customerEmail || "—"}</div>
          <div><span className="text-gray-500">Спосіб доставки:</span> {
            order.deliveryMethod === "nova_poshta_branch" ? "Нова Пошта (відділення)" :
            order.deliveryMethod === "nova_poshta_courier" ? "Нова Пошта (кур'єр)" : order.deliveryMethod
          }</div>
          <div><span className="text-gray-500">Місто:</span> {order.deliveryCity || "—"}</div>
          <div><span className="text-gray-500">Відділення/поштомат:</span> {order.deliveryBranchName || "—"}</div>
          {order.deliveryBranchRef && <div><span className="text-gray-500">NP Ref:</span> <span className="font-mono text-xs">{order.deliveryBranchRef}</span></div>}
          {order.deliveryAddress && <div><span className="text-gray-500">Адреса:</span> {order.deliveryAddress}</div>}
        </div>
        {order.comment && <div className="mt-2 text-sm"><span className="text-gray-500">Коментар:</span> {order.comment}</div>}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <h2 className="font-semibold p-4 border-b">Товари</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-gray-500">Назва</th>
              <th className="text-left px-4 py-2 text-gray-500">SKU</th>
              <th className="text-right px-4 py-2 text-gray-500">Ціна</th>
              <th className="text-center px-4 py-2 text-gray-500">К-ть</th>
              <th className="text-right px-4 py-2 text-gray-500">Сума</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 text-gray-500">{item.sku}</td>
                <td className="px-4 py-2 text-right">{formatPrice(item.price)}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr><td colSpan={4} className="px-4 py-2 text-right font-medium">Разом:</td><td className="px-4 py-2 text-right font-bold">{formatPrice(order.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {/* Payment Events */}
      {order.payments.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <h2 className="font-semibold p-4 border-b">Payment Events</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500">Час</th>
                <th className="text-left px-4 py-2 text-gray-500">Тип</th>
                <th className="text-left px-4 py-2 text-gray-500">Provider</th>
                <th className="text-right px-4 py-2 text-gray-500">Сума</th>
                <th className="text-center px-4 py-2 text-gray-500">Підпис</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-xs">{new Date(p.createdAt).toLocaleString("uk-UA")}</td>
                  <td className="px-4 py-2">{p.eventType}</td>
                  <td className="px-4 py-2">{p.provider}</td>
                  <td className="px-4 py-2 text-right">{formatPrice(p.amount)}</td>
                  <td className="px-4 py-2 text-center">{p.signatureValid ? "Valid" : "Invalid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Integration Logs */}
      {order.integrationLogs.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <h2 className="font-semibold p-4 border-b">Integration Logs</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500">Час</th>
                <th className="text-left px-4 py-2 text-gray-500">Інтеграція</th>
                <th className="text-left px-4 py-2 text-gray-500">Endpoint</th>
                <th className="text-center px-4 py-2 text-gray-500">Статус</th>
                <th className="text-left px-4 py-2 text-gray-500">Помилка</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.integrationLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-xs">{new Date(log.createdAt).toLocaleString("uk-UA")}</td>
                  <td className="px-4 py-2">{log.integration}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.endpoint}</td>
                  <td className="px-4 py-2 text-center">{log.responseStatus ?? "—"}</td>
                  <td className="px-4 py-2 text-red-500 text-xs">{log.errorMessage || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
