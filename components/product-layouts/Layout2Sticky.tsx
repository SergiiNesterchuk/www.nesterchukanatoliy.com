import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import { ProductDeliveryInfo } from "./ProductDeliveryInfo";
import type { ProductDetail } from "@/entities/product";

export function Layout2Sticky({ product }: { product: ProductDetail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      {/* Left: sticky gallery */}
      <div className="md:sticky md:top-24 md:self-start">
        <ProductGallery images={product.images} productName={product.name} />
      </div>
      {/* Right: scrollable content */}
      <div className="space-y-8">
        <ProductPurchaseBox product={product} />
        <ProductDeliveryInfo />
        <ProductTabs description={product.description} />
        <ProductReviews productId={product.id} />
      </div>
    </div>
  );
}
