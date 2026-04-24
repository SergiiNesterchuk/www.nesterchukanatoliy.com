"use client";

import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import { ProductDeliveryInfo } from "./ProductDeliveryInfo";
import type { ProductDetail } from "@/entities/product";

export function Layout4Compact({ product }: { product: ProductDetail }) {
  return (
    <div>
      {/* Compact purchase block */}
      <div className="bg-white rounded-xl border p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
          <div className="aspect-square rounded-lg overflow-hidden bg-gray-50">
            {product.images[0] ? (
              <img src={product.images[0].url} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">Фото</div>
            )}
          </div>
          <ProductPurchaseBox product={product} />
        </div>
      </div>
      {/* Gallery */}
      {product.images.length > 1 && (
        <div className="mb-6">
          <ProductGallery images={product.images} productName={product.name} />
        </div>
      )}
      <ProductDeliveryInfo />
      <div className="mt-6"><ProductTabs description={product.description} /></div>
      <ProductReviews productId={product.id} />
    </div>
  );
}
