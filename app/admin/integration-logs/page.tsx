import { prisma } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationLogsPage() {
  let logs: Awaited<ReturnType<typeof prisma.integrationLog.findMany>> = [];
  try {
    logs = await prisma.integrationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    // DB unavailable
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Логи інтеграцій</h1>

      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Час</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Інтеграція</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Напрям</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Метод</th>
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
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    {log.integration}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{log.direction}</td>
                <td className="px-4 py-3 text-xs font-mono">{log.method}</td>
                <td className="px-4 py-3 text-xs font-mono max-w-[200px] truncate">
                  {log.endpoint}
                </td>
                <td className="px-4 py-3 text-center">
                  {log.responseStatus && (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        log.responseStatus < 300
                          ? "bg-green-100 text-green-800"
                          : log.responseStatus < 500
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {log.responseStatus}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">
                  {log.durationMs ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-red-600 max-w-[200px] truncate">
                  {log.errorMessage || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-8 text-center text-gray-500">Логів немає</div>
        )}
      </div>
    </div>
  );
}
