import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/shared/db";
import { formatPrice } from "@/shared/money";
import { ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  new: "Нове", approval: "Погодження", production: "Виробництво",
  delivery: "Доставка", completed: "Виконано", cancelled: "Скасовано",
  // Legacy
  confirmed: "Підтверджено", processing: "В обробці", paid: "Оплачено",
  partial_paid: "Передплата", shipped: "Відправлено", delivered: "Доставлено",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Очікує", cod_pending: "При отриманні", awaiting_prepayment: "Очікує передплати",
  partial_paid: "Передплата", paid: "Оплачено", failed: "Помилка", refunded: "Повернено",
};

function badge(value: string, labels: Record<string, string>) {
  const text = labels[value] || value;
  const color = ["paid", "completed", "delivered", "partial_paid"].includes(value)
    ? "bg-green-50 text-green-700" : ["failed", "cancelled", "refunded"].includes(value)
    ? "bg-red-50 text-red-700" : ["delivery", "shipped", "production"].includes(value)
    ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-700";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{text}</span>;
}

export default async function AccountOrdersPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login");

  let orders: Array<{
    orderNumber: string; publicOrderNumber: string | null; status: string;
    paymentStatus: string; total: number; createdAt: Date;
    items: Array<{ name: string }>;
  }> = [];

  try {
    orders = await prisma.order.findMany({
      where: { customerEmail: session.user.email },
      include: { items: { select: { name: true }, take: 3 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch { /* */ }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Мої замовлення</h1>
        <div className="text-sm text-gray-500">{session.user.email}</div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">У вас поки немає замовлень</p>
          <Link href="/katalog/" className="text-green-600 hover:underline">Перейти до каталогу</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const num = order.publicOrderNumber || order.orderNumber;
            return (
              <Link key={order.orderNumber} href={`/account/orders/${num}`}
                className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">№{num}</span>
                  <span className="text-sm text-gray-400">{order.createdAt.toLocaleDateString("uk-UA")}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {badge(order.status, STATUS_LABELS)}
                  {badge(order.paymentStatus, PAYMENT_LABELS)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 truncate">{order.items.map((i) => i.name).join(", ")}</span>
                  <span className="font-medium flex-shrink-0 ml-2">{formatPrice(order.total)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <form action={async () => { "use server"; const { signOut } = await import("@/auth"); await signOut({ redirectTo: "/" }); }}>
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">Вийти з кабінету</button>
        </form>
      </div>
    </div>
  );
}
