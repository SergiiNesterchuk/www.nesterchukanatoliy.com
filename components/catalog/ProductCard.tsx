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
        {product.reviewCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <span>{product.reviewCount} {product.reviewCount === 1 ? "відгук" : product.reviewCount < 5 ? "відгуки" : "відгуків"}</span>
          </div>
        )}
        <StockBadge stockStatus={product.stockStatus} />
        {!outOfStock && <AddToCartButton product={product} size="sm" />}
      </div>
    </article>
  );
}
