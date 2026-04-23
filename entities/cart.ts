export interface CartItem {
  productId: string;
  productSlug: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  stockStatus: string;
  maxQuantity: number | null;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

export interface CartValidationResult {
  valid: boolean;
  items: Array<
    CartItem & {
      available: boolean;
      currentPrice: number;
      priceChanged: boolean;
      stockAvailable: number | null;
      quantityAdjusted: boolean;
    }
  >;
  errors: string[];
}
