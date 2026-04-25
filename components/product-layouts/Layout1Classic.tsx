import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import type { ProductDetail } from "@/entities/product";

interface Props { product: ProductDetail; deliveryText?: string; paymentText?: string; }

export function Layout1Classic({ product, deliveryText, paymentText }: Props) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />
        <ProductPurchaseBox product={product} />
      </div>
      <div className="mt-8"><ProductTabs description={product.description} deliveryText={deliveryText} paymentText={paymentText} /></div>
      <ProductReviews productId={product.id} />
    </div>
  );
}
