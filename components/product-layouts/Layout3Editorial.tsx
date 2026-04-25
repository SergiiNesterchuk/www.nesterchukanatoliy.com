import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import type { ProductDetail } from "@/entities/product";

interface Props { product: ProductDetail; deliveryText?: string; paymentText?: string; }

export function Layout3Editorial({ product, deliveryText, paymentText }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8"><ProductGallery images={product.images} productName={product.name} /></div>
      <div className="mb-8 bg-green-50 rounded-xl p-6"><ProductPurchaseBox product={product} /></div>
      <ProductTabs description={product.description} deliveryText={deliveryText} paymentText={paymentText} />
      <ProductReviews productId={product.id} />
    </div>
  );
}
