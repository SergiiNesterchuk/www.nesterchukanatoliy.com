import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { prisma } from "@/shared/db";

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
    checkout_failed_text: "Оплата не була завершена. Ваше замовлення збережено — ви можете спробувати оплатити ще раз або зв'язатися з нами.",
    checkout_pending_title: "Очікуємо підтвердження оплати",
    checkout_pending_text: "Ваше замовлення прийнято. Оплата ще обробляється — ми повідомимо вас коли вона буде підтверджена.",
  };

  try {
    const settings = await prisma.settings.findMany({
      where: { key: { startsWith: "checkout_" } },
    });
    for (const s of settings) {
      if (s.value) defaults[s.key] = s.value;
    }
  } catch { /* */ }

  return defaults;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string }>;
}) {
  const { order, status } = await searchParams;
  const isFailed = status === "failed" || status === "Declined";
  const isPending = status === "pending";
  const hp = await getPageSettings();

  const title = isFailed
    ? hp.checkout_failed_title
    : isPending
      ? hp.checkout_pending_title
      : hp.checkout_success_title;

  const text = isFailed
    ? hp.checkout_failed_text
    : isPending
      ? hp.checkout_pending_text
      : hp.checkout_success_text;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="flex justify-center mb-6">
        {isFailed ? (
          <XCircle className="h-16 w-16 text-red-500" />
        ) : isPending ? (
          <Clock className="h-16 w-16 text-yellow-500" />
        ) : (
          <CheckCircle className="h-16 w-16 text-green-600" />
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

      {order && (
        <p className="mt-2 text-lg text-gray-600">
          Номер замовлення: <span className="font-semibold font-mono">{order}</span>
        </p>
      )}

      <p className="mt-4 text-gray-500">{text}</p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/"
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          На головну
        </Link>
        <Link
          href="/kontaktna-informatsiya/"
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Зв&apos;язатися з нами
        </Link>
      </div>
    </div>
  );
}
