import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/shared/db";
import { formatPrice } from "@/shared/money";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: any[] = [];
  try {
    products = await prisma.product.findMany({
      include: { category: true, images: { take: 1, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
  } catch {
    // DB unavailable
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Товари</h1>
        <Link href="/admin/products/new">
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Додати товар
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Назва</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Категорія</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Ціна</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Кількість</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{product.sku}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-medium text-gray-900 hover:text-green-600"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{product.category.name}</td>
                <td className="px-4 py-3 text-right font-medium">{formatPrice(product.price)}</td>
                <td className="px-4 py-3 text-center">{product.quantity ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.stockStatus === "in_stock"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {product.stockStatus === "in_stock" ? "В наявності" : "Немає"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="p-8 text-center text-gray-500">Товарів немає</div>
        )}
      </div>
    </div>
  );
}
