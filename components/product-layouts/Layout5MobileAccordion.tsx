"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import type { ProductDetail } from "@/entities/product";

function AccordionSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-4 text-left">
        <span className="font-medium text-gray-900">{title}</span>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

interface Props { product: ProductDetail; deliveryText?: string; paymentText?: string; }

export function Layout5MobileAccordion({ product, deliveryText, paymentText }: Props) {
  return (
    <div>
      <ProductGallery images={product.images} productName={product.name} />
      <div className="mt-6"><ProductPurchaseBox product={product} /></div>
      <div className="mt-6 border-t">
        {product.description && (
          <AccordionSection title="Опис" defaultOpen>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
          </AccordionSection>
        )}
        {(deliveryText || paymentText) && (
          <AccordionSection title="Доставка та оплата">
            {deliveryText && <div className="prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: deliveryText }} />}
            {paymentText && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: paymentText }} />}
          </AccordionSection>
        )}
        <AccordionSection title="Відгуки">
          <ProductReviews productId={product.id} />
        </AccordionSection>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex items-center justify-between gap-3 md:hidden z-20">
        <div>
          <div className="text-lg font-bold">{(product.price / 100).toFixed(0)} грн</div>
          <div className="text-xs text-gray-500">{product.stockStatus === "in_stock" ? "В наявності" : "Немає"}</div>
        </div>
        {product.stockStatus === "in_stock" && (
          <button onClick={() => { const { useCartStore } = require("@/hooks/useCart"); useCartStore.getState().addItem({ productId: product.id, productSlug: product.slug, name: product.name, sku: product.sku, price: product.price, imageUrl: product.images[0]?.url || null, stockStatus: product.stockStatus, maxQuantity: product.quantity ?? 99 }); }} className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">Купити</button>
        )}
      </div>
      <div className="h-16 md:hidden" />
    </div>
  );
}
