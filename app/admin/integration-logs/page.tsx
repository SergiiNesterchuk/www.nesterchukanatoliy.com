import { prisma } from "@/shared/db";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationLogsPage() {
  let stats = { pendingSync: 0, failedSync: 0, paidNotSynced: 0, recentErrors: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logs: any[] = [];

  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pendingSync, failedSync, paidNotSynced, recentErrors, recentLogs] = await Promise.all([
      prisma.order.count({ where: { keycrmSyncStatus: "pending", paymentStatus: "paid" } }),
      prisma.order.count({ where: { keycrmSyncStatus: "failed" } }),
      prisma.order.count({ where: { paymentStatus: "paid", keycrmSyncStatus: { in: ["pending", "failed"] } } }),
      prisma.integrationLog.count({ where: { responseStatus: { gte: 400 }, isResolved: false, createdAt: { gte: dayAgo } } }),
      prisma.integrationLog.findMany({ where: { isResolved: false }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    stats = { pendingSync, failedSync, paidNotSynced, recentErrors };
    logs = recentLogs;
  } catch { /* */ }

  const crmHealthy = stats.failedSync === 0 && stats.paidNotSynced === 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Моніторинг інтеграцій</h1>

      {/* Health Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <HealthCard label="CRM Sync" ok={crmHealthy} detail={crmHealthy ? "OK" : `${stats.paidNotSynced} не синхронізовано`} />
        <HealthCard label="Pending Sync" ok={stats.pendingSync === 0} detail={`${stats.pendingSync} замовлень`} />
        <HealthCard label="Failed Sync" ok={stats.failedSync === 0} detail={`${stats.failedSync} помилок`} />
        <HealthCard label="Помилки (24г)" ok={stats.recentErrors === 0} detail={`${stats.recentErrors} помилок`} />
      </div>

      {/* Retry Action */}
      {stats.pendingSync > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-yellow-600" />
            <span className="text-sm text-yellow-800">{stats.pendingSync} замовлень очікують синхронізації</span>
          </div>
          <a
            href={`${siteUrl}/api/revalidate?action=sync&secret=${process.env.ADMIN_JWT_SECRET || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700"
          >
            Запустити sync
          </a>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Час</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Інтеграція</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Напрям</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Endpoint</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Статус</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Час (мс)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Помилка</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {log.createdAt.toLocaleString("uk-UA")}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    log.integration === "keycrm" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                  }`}>
                    {log.integration}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{log.direction}</td>
                <td className="px-4 py-3 text-xs font-mono max-w-[200px] truncate">{log.endpoint}</td>
                <td className="px-4 py-3 text-center">
                  {log.responseStatus != null && (
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      log.responseStatus < 300 ? "bg-green-100 text-green-800" :
                      log.responseStatus < 500 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                    }`}>
                      {log.responseStatus}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{log.durationMs ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-red-600 max-w-[200px] truncate">{log.errorMessage || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="p-8 text-center text-gray-500">Логів немає</div>}
      </div>
    </div>
  );
}

function HealthCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${ok ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
        {ok ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </div>
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{detail}</div>
      </div>
    </div>
  );
}
