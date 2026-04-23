import Link from "next/link";
import { PriceDisplay } from "./PriceDisplay";
import { StockBadge } from "./StockBadge";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import type { ProductListItem } from "@/entities/product";
import { cn } from "@/shared/cn";

interface ProductCardProps {
  product: ProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = product.stockStatus !== "in_stock";

  return (
    <article className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/${product.slug}/`} className="block relative aspect-[3/4] bg-gray-50">
        {product.coverImage ? (
          <img
            src={product.coverImage}
            alt={product.name}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105",
              outOfStock && "grayscale opacity-60"
            )}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </Link>
      <div className="p-4 space-y-2">
        <Link href={`/${product.slug}/`}>
          <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-green-600 transition-colors">
            {product.name}
          </h3>
        </Link>
        <PriceDisplay price={product.price} compareAtPrice={product.compareAtPrice} />
        <StockBadge stockStatus={product.stockStatus} />
        {!outOfStock && <AddToCartButton product={product} size="sm" />}
      </div>
    </article>
  );
}
