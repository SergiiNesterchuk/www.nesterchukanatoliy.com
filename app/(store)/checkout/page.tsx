import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Оформлення замовлення",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: "Оформлення замовлення" }]} />
      <h1 className="mt-4 text-2xl md:text-3xl font-bold text-gray-900 mb-6">
        Оформлення замовлення
      </h1>
      <CheckoutForm />
    </div>
  );
}
