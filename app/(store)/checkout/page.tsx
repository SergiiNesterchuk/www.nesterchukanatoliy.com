import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { prisma } from "@/shared/db";

export const metadata: Metadata = {
  title: "Оформлення замовлення",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  let requireTerms = true;
  try {
    const setting = await prisma.settings.findUnique({ where: { key: "checkout_require_terms" } });
    if (setting?.value === "false") requireTerms = false;
  } catch { /* */ }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: "Оформлення замовлення" }]} />
      <h1 className="mt-4 text-2xl md:text-3xl font-bold text-gray-900 mb-6">
        Оформлення замовлення
      </h1>
      <CheckoutForm requireTerms={requireTerms} />
    </div>
  );
}
