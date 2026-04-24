"use client";

import { PriceDisplay } from "@/components/catalog/PriceDisplay";
import { StockBadge } from "@/components/catalog/StockBadge";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import type { ProductDetail } from "@/entities/product";

export function ProductPurchaseBox({ product }: { product: ProductDetail }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>
      <div className="flex items-center gap-4">
        <PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
        <StockBadge stockStatus={product.stockStatus} quantity={product.quantity} />
      </div>
      <div className="text-sm text-gray-500">Артикул: {product.sku}</div>
      {product.shortDescription && <p className="text-gray-600 leading-relaxed">{product.shortDescription}</p>}
      <AddToCartButton product={product} size="lg" showQuantity />
    </div>
  );
}
