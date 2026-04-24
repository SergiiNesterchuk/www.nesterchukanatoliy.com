import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import { ProductDeliveryInfo } from "./ProductDeliveryInfo";
import type { ProductDetail } from "@/entities/product";

export function Layout3Editorial({ product }: { product: ProductDetail }) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero image */}
      <div className="mb-8">
        <ProductGallery images={product.images} productName={product.name} />
      </div>
      {/* Purchase */}
      <div className="mb-8 bg-green-50 rounded-xl p-6">
        <ProductPurchaseBox product={product} />
      </div>
      {/* Long-form content */}
      <div className="mb-8"><ProductDeliveryInfo /></div>
      <ProductTabs description={product.description} />
      <ProductReviews productId={product.id} />
    </div>
  );
}
