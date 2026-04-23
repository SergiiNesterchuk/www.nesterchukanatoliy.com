import { ProductRepository } from "@/repositories/ProductRepository";
import type { CartValidationResult } from "@/entities/cart";

export class CartService {
  static async validateCart(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<CartValidationResult> {
    const productIds = items.map((item) => item.productId);
    const products = await ProductRepository.findByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const errors: string[] = [];
    const validatedItems = items.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        errors.push(`Товар не знайдено: ${item.productId}`);
        return {
          productId: item.productId,
          productSlug: "",
          name: "Товар не знайдено",
          sku: "",
          price: 0,
          quantity: item.quantity,
          imageUrl: null,
          stockStatus: "out_of_stock",
          maxQuantity: null,
          available: false,
          currentPrice: 0,
          priceChanged: false,
          stockAvailable: null,
          quantityAdjusted: false,
        };
      }

      const available = product.stockStatus === "in_stock";
      const maxQty = product.quantity;
      let adjustedQty = item.quantity;
      let quantityAdjusted = false;

      if (maxQty !== null && adjustedQty > maxQty) {
        adjustedQty = maxQty;
        quantityAdjusted = true;
        if (maxQty === 0) {
          errors.push(`${product.name} — немає в наявності`);
        } else {
          errors.push(`${product.name} — доступно лише ${maxQty} шт.`);
        }
      }

      return {
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: adjustedQty,
        imageUrl: product.images[0]?.url ?? null,
        stockStatus: product.stockStatus,
        maxQuantity: product.quantity,
        available,
        currentPrice: product.price,
        priceChanged: false,
        stockAvailable: product.quantity,
        quantityAdjusted,
      };
    });

    return {
      valid: errors.length === 0,
      items: validatedItems,
      errors,
    };
  }
}
