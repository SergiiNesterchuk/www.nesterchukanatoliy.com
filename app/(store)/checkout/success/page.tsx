import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Clock, XCircle, Package } from "lucide-react";
import { prisma } from "@/shared/db";
import { OrderCopyButton } from "./OrderCopyButton";

export const metadata: Metadata = {
  title: "Замовлення прийнято",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function getPageSettings() {
  const defaults: Record<string, string> = {
    checkout_success_title: "Замовлення прийнято!",
    checkout_success_text: "Дякуємо за замовлення! Ми зв'яжемось з вами найближчим часом для підтвердження.",
    checkout_failed_title: "Оплата не пройшла",
    checkout_failed_text: "Оплата не була завершена. Ваше замовлення збережено.",
    checkout_cod_title: "Замовлення створено!",
    checkout_cod_text: "Дякуємо! Оплата при отриманні на пошті. Ми зв'яжемось для підтвердження.",
  };
  try {
    const settings = await prisma.settings.findMany({ where: { key: { startsWith: "checkout_" } } });
    for (const s of settings) { if (s.value) defaults[s.key] = s.value; }
  } catch { /* */ }
  return defaults;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string; pm?: string }>;
}) {
  const { order, status, pm } = await searchParams;
  const isFailed = status === "failed" || status === "Declined";
  const isCod = pm?.includes("cod");
  const hp = await getPageSettings();

  const title = isFailed ? hp.checkout_failed_title : isCod ? hp.checkout_cod_title : hp.checkout_success_title;
  const text = isFailed ? hp.checkout_failed_text : isCod ? hp.checkout_cod_text : hp.checkout_success_text;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="flex justify-center mb-6">
        {isFailed ? <XCircle className="h-16 w-16 text-red-500" /> : isCod ? <Package className="h-16 w-16 text-green-600" /> : <CheckCircle className="h-16 w-16 text-green-600" />}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

      {order && (
        <div className="mt-3">
          <p className="text-lg text-gray-600">Номер замовлення:</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-xl font-bold font-mono text-gray-900">{order}</span>
            <OrderCopyButton orderNumber={order} />
          </div>
          <p className="mt-1 text-xs text-gray-400">Збережіть цей номер для перевірки статусу</p>
        </div>
      )}

      <p className="mt-4 text-gray-500">{text}</p>

      {isCod && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-700">
          <Clock className="h-5 w-5 inline mr-1" />Оплата при отриманні на пошті
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
