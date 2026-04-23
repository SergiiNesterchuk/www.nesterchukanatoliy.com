import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Замовлення прийнято",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="flex justify-center mb-6">
        <CheckCircle className="h-16 w-16 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Замовлення прийнято!</h1>
      {order && (
        <p className="mt-2 text-lg text-gray-600">
          Номер замовлення: <span className="font-semibold">{order}</span>
        </p>
      )}
      <p className="mt-4 text-gray-500">
        Дякуємо за замовлення! Ми зв&apos;яжемось з вами найближчим часом для підтвердження.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
      >
        На головну
      </Link>
    </div>
  );
}
