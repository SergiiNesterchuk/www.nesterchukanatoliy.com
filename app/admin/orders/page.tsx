import { prisma } from "@/shared/db";
import { formatPrice } from "@/shared/money";
import { ORDER_STATUSES, PAYMENT_STATUSES, CRM_SYNC_STATUSES } from "@/shared/constants";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let orders: Awaited<ReturnType<typeof prisma.order.findMany>> = [];
  try {
    orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    // DB unavailable
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Замовлення</h1>
      <p className="text-sm text-gray-500 mb-4">
        Технічний контроль замовлень. Повне управління — у KeyCRM.
      </p>

      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Клієнт</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Сума</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Статус</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Оплата</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">CRM Sync</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Дата</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{order.customerName}</div>
                  <div className="text-gray-500 text-xs">{order.customerPhone}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatPrice(order.total)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {ORDER_STATUSES[order.status as keyof typeof ORDER_STATUSES] || order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      order.paymentStatus === "paid"
                        ? "bg-green-100 text-green-800"
                        : order.paymentStatus === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {PAYMENT_STATUSES[order.paymentStatus as keyof typeof PAYMENT_STATUSES] || order.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      order.keycrmSyncStatus === "synced"
                        ? "bg-green-100 text-green-800"
                        : order.keycrmSyncStatus === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {CRM_SYNC_STATUSES[order.keycrmSyncStatus as keyof typeof CRM_SYNC_STATUSES] || order.keycrmSyncStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {order.createdAt.toLocaleString("uk-UA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="p-8 text-center text-gray-500">Замовлень немає</div>
        )}
      </div>
    </div>
  );
}
