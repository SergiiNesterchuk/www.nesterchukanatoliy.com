import { prisma } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  let settings: Awaited<ReturnType<typeof prisma.settings.findMany>> = [];
  try {
    settings = await prisma.settings.findMany({
      orderBy: { key: "asc" },
    });
  } catch {
    // DB unavailable
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Налаштування</h1>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ключ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Значення</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settings.map((setting) => (
              <tr key={setting.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{setting.key}</td>
                <td className="px-4 py-3 text-gray-900">{setting.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        Редагування налаштувань буде доступне у наступній версії.
        Зараз використовуйте seed або Prisma Studio.
      </div>
    </div>
  );
}
