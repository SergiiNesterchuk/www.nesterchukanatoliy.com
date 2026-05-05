import { prisma } from "@/shared/db";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { SyncFromProductionButton } from "@/components/admin/SyncFromProductionButton";

const isStaging = process.env.NEXT_PUBLIC_APP_ENV === "staging";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [
      totalProducts,
      totalOrders,
      pendingSync,
      paidNotSynced,
      recentErrors,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { keycrmSyncStatus: "pending", paymentStatus: "paid" } }),
      prisma.order.count({
        where: { paymentStatus: "paid", keycrmSyncStatus: { in: ["pending", "failed"] } },
      }),
      prisma.integrationLog.count({
        where: {
          responseStatus: { gte: 400 },
          isResolved: false,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return { totalProducts, totalOrders, pendingSync, paidNotSynced, recentErrors };
  } catch {
    return { totalProducts: 0, totalOrders: 0, pendingSync: 0, paidNotSynced: 0, recentErrors: 0 };
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const cards = [
    {
      label: "Активних товарів",
      value: stats.totalProducts,
      icon: Package,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Замовлень",
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Pending CRM sync",
      value: stats.pendingSync,
      icon: stats.pendingSync > 0 ? AlertTriangle : CheckCircle,
      color: stats.pendingSync > 0 ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50",
    },
    {
      label: "Paid but not synced",
      value: stats.paidNotSynced,
      icon: stats.paidNotSynced > 0 ? AlertTriangle : CheckCircle,
      color: stats.paidNotSynced > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border p-4 flex items-start gap-3"
          >
            <div className={`p-2 rounded-lg ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {isStaging && (
        <div className="mt-6">
          <SyncFromProductionButton />
        </div>
      )}

      {stats.recentErrors > 0 && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium">
            <AlertTriangle className="h-5 w-5" />
            {stats.recentErrors} помилок інтеграції за останні 24 години
          </div>
          <a href="/admin/integration-logs" className="text-sm text-red-600 hover:underline mt-1 block">
            Переглянути логи &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
