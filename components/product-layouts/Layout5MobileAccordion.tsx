"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import { ProductDeliveryInfo } from "./ProductDeliveryInfo";
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

export function Layout5MobileAccordion({ product }: { product: ProductDetail }) {
  return (
    <div>
      <ProductGallery images={product.images} productName={product.name} />

      <div className="mt-6">
        <ProductPurchaseBox product={product} />
      </div>

      <div className="mt-6 border-t">
        <AccordionSection title="Опис" defaultOpen>
          {product.description ? (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
          ) : (
            <p className="text-sm text-gray-500">Опис не додано</p>
          )}
        </AccordionSection>

        <AccordionSection title="Доставка та оплата">
          <ProductDeliveryInfo />
        </AccordionSection>

        <AccordionSection title="Відгуки">
          <ProductReviews productId={product.id} />
        </AccordionSection>
      </div>

      {/* Sticky bottom buy bar on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex items-center justify-between gap-3 md:hidden z-20">
        <div>
          <div className="text-lg font-bold text-gray-900">{(product.price / 100).toFixed(0)} грн</div>
          <div className="text-xs text-gray-500">{product.stockStatus === "in_stock" ? "В наявності" : "Немає"}</div>
        </div>
        {product.stockStatus === "in_stock" && (
          <button
            onClick={() => {
              // Trigger add to cart from cart store
              const { useCartStore } = require("@/hooks/useCart");
              useCartStore.getState().addItem({
                productId: product.id,
                productSlug: product.slug,
                name: product.name,
                sku: product.sku,
                price: product.price,
                imageUrl: product.images[0]?.url || null,
                stockStatus: product.stockStatus,
                maxQuantity: product.quantity ?? 99,
              });
            }}
            className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
          >
            Купити
          </button>
        )}
      </div>
      {/* Spacer for sticky bar */}
      <div className="h-16 md:hidden" />
    </div>
  );
}
