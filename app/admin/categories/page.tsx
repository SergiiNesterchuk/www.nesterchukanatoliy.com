import { prisma } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  let categories: Array<{
    id: string; name: string; slug: string; sortOrder: number; isActive: boolean;
    _count: { products: number };
  }> = [];
  try {
    categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });
  } catch {
    // DB unavailable
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Категорії</h1>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Назва</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Товарів</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Порядок</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Активна</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                <td className="px-4 py-3 text-center">{cat._count.products}</td>
                <td className="px-4 py-3 text-center">{cat.sortOrder}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      cat.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {cat.isActive ? "Так" : "Ні"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
