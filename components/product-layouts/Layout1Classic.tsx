import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductReviews } from "@/components/catalog/ProductReviews";
import { ProductPurchaseBox } from "./ProductPurchaseBox";
import { ProductDeliveryInfo } from "./ProductDeliveryInfo";
import type { ProductDetail } from "@/entities/product";

export function Layout1Classic({ product }: { product: ProductDetail }) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />
        <ProductPurchaseBox product={product} />
      </div>
      <div className="mt-8"><ProductDeliveryInfo /></div>
      <div className="mt-8"><ProductTabs description={product.description} /></div>
      <ProductReviews productId={product.id} />
    </div>
  );
}
