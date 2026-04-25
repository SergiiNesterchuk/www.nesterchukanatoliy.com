import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import type { ProductDetail } from "@/entities/product";

interface Props { product: ProductDetail; deliveryText?: string; paymentText?: string; }

export function Layout2Sticky({ product, deliveryText, paymentText }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      <div className="md:sticky md:top-24 md:self-start">
        <ProductGallery images={product.images} productName={product.name} />
      </div>
      <div className="space-y-8">
        <ProductPurchaseBox product={product} />
        <ProductTabs description={product.description} deliveryText={deliveryText} paymentText={paymentText} />
        <ProductReviews productId={product.id} />
      </div>
    </div>
  );
}
