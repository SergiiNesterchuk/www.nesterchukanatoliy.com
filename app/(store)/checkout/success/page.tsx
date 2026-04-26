import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Clock, XCircle, Package, CreditCard } from "lucide-react";
import { prisma } from "@/shared/db";
import { OrderCopyButton } from "./OrderCopyButton";

export const metadata: Metadata = {
  title: "Замовлення прийнято",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FALLBACK_MESSAGE = "Замовлення прийнято! Наш менеджер зв'яжеться з вами найближчим часом.";

/** Підставити шаблонні змінні в текст */
function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value || "");
  }
  // Видалити залишкові невідомі змінні типу {unknownVar}
  result = result.replace(/\{[a-zA-Z]+\}/g, "");
  return result.trim();
}

function formatAmount(kopiyky: number): string {
  const uah = kopiyky / 100;
  return Number.isInteger(uah) ? `${uah}` : uah.toFixed(2);
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string; pm?: string }>;
}) {
  const { order: orderNumber, status, pm } = await searchParams;
  const isFailed = status === "failed" || status === "Declined";

  // Підвантажити замовлення з БД для отримання деталей
  let orderData: {
    orderNumber: string;
    total: number;
    prepaymentAmount: number | null;
    paymentMethod: string;
    paymentStatus: string;
    paymentPurpose: string | null;
  } | null = null;

  let successMessage = FALLBACK_MESSAGE;

  if (orderNumber && !isFailed) {
    try {
      orderData = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber },
            { publicOrderNumber: orderNumber },
          ],
        },
        select: {
          orderNumber: true,
          total: true,
          prepaymentAmount: true,
          paymentMethod: true,
          paymentStatus: true,
          paymentPurpose: true,
        },
      });

      if (orderData) {
        // Знайти paymentMethod і його customerInstruction
        const pmRecord = await prisma.paymentMethod.findFirst({
          where: { key: orderData.paymentMethod },
          select: { customerInstruction: true, title: true },
        });

        const template = pmRecord?.customerInstruction || FALLBACK_MESSAGE;
        const total = orderData.total;
        const prepayment = orderData.prepaymentAmount || 0;
        // Для COD передплати: навіть якщо callback ще не оновив paymentStatus,
        // показуємо prepaymentAmount як оплачену суму (клієнт вже заплатив)
        const isCodPrepay = orderData.paymentPurpose === "cod_prepayment";
        const paid = orderData.paymentStatus === "paid" ? total
          : orderData.paymentStatus === "partial_paid" ? prepayment
          : isCodPrepay ? prepayment  // fallback: передплата була відправлена
          : 0;
        const remaining = isCodPrepay ? (total - prepayment) : (total - paid);

        successMessage = renderTemplate(template, {
          orderNumber: orderData.orderNumber,
          totalAmount: formatAmount(total),
          paidAmount: formatAmount(paid),
          prepaymentAmount: formatAmount(prepayment),
          remainingAmount: formatAmount(remaining),
          paymentMethodTitle: pmRecord?.title || "",
        });
      }
    } catch { /* fallback */ }
  }

  // Визначити іконку і заголовок
  const isCod = pm?.includes("cod") || orderData?.paymentPurpose === "cod_prepayment";
  const isBankTransfer = pm === "bank_transfer" || orderData?.paymentMethod === "bank_transfer";

  const title = isFailed
    ? "Оплата не пройшла"
    : isBankTransfer
      ? "Замовлення прийнято!"
      : isCod
        ? "Передплату отримано!"
        : "Замовлення прийнято!";

  const Icon = isFailed ? XCircle : isBankTransfer ? CreditCard : isCod ? Package : CheckCircle;
  const iconColor = isFailed ? "text-red-500" : "text-green-600";

  // Для failed — окремий текст
  if (isFailed) {
    successMessage = "Оплата не була завершена. Ваше замовлення збережено — ви можете спробувати оплатити пізніше.";
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="flex justify-center mb-6">
        <Icon className={`h-16 w-16 ${iconColor}`} />
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

      {orderNumber && (
        <div className="mt-3">
          <p className="text-lg text-gray-600">Номер замовлення:</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-xl font-bold font-mono text-gray-900">{orderNumber}</span>
            <OrderCopyButton orderNumber={orderNumber} />
          </div>
          <p className="mt-1 text-xs text-gray-400">Збережіть цей номер для перевірки статусу</p>
        </div>
      )}

      <p className="mt-4 text-gray-500 leading-relaxed">{successMessage}</p>

      {isCod && !isFailed && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-700">
          <Clock className="h-5 w-5 inline mr-1" />Решту суми ви сплатите при отриманні на пошті
        </div>
      )}

      {isBankTransfer && !isFailed && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <CreditCard className="h-5 w-5 inline mr-1" />Менеджер надішле реквізити
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/order-status/" className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors">
          Перевірити статус
        </Link>
        <Link href="/" className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
          На головну
        </Link>
      </div>
    </div>
  );
}
