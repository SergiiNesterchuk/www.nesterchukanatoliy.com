import { prisma } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  let pages: Awaited<ReturnType<typeof prisma.page.findMany>> = [];
  try {
    pages = await prisma.page.findMany({
      orderBy: { sortOrder: "asc" },
    });
  } catch {
    // DB unavailable
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Сторінки</h1>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Заголовок</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Активна</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Оновлено</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pages.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{page.title}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">/{page.slug}/</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      page.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {page.isActive ? "Так" : "Ні"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {page.updatedAt.toLocaleString("uk-UA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
