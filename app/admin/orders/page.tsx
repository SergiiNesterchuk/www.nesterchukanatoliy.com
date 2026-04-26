"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { adminFetch } from "@/shared/admin-fetch";
import { formatPrice } from "@/shared/money";
import { ORDER_STATUSES, PAYMENT_STATUSES, CRM_SYNC_STATUSES } from "@/shared/constants";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentStatus: string;
  keycrmSyncStatus: string;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = (q = "") => {
    setLoading(true);
    const params = q ? `?search=${encodeURIComponent(q)}` : "";
    adminFetch(`/api/admin/orders${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setOrders(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => load(search);

  const badge = (value: string, map: Record<string, string>, color: string) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {map[value] || value}
    </span>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Замовлення</h1>
      <p className="text-sm text-gray-500 mb-4">Технічний контроль. Повне управління — у KeyCRM.</p>

      <div className="flex gap-2 mb-4">
        <Input
          id="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук по номеру, імені, телефону, email..."
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch} className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Шукати</button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Завантаження...</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Клієнт</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Сума</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Статус</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Оплата</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">CRM</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{order.customerName}</div>
                    <div className="text-gray-500 text-xs">{order.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3 text-center">{badge(order.status, ORDER_STATUSES, "bg-gray-100 text-gray-800")}</td>
                  <td className="px-4 py-3 text-center">
                    {badge(order.paymentStatus, PAYMENT_STATUSES,
                      order.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
                      order.paymentStatus === "failed" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {badge(order.keycrmSyncStatus, CRM_SYNC_STATUSES,
                      order.keycrmSyncStatus === "synced" ? "bg-green-100 text-green-800" :
                      order.keycrmSyncStatus === "failed" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(order.createdAt).toLocaleDateString("uk-UA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="p-8 text-center text-gray-500">Замовлень немає</div>}
        </div>
      )}
    </div>
  );
}
