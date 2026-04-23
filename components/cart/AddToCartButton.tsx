"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { useCartStore } from "@/hooks/useCart";

interface AddToCartButtonProps {
  product: {
    id: string;
    slug: string;
    name: string;
    sku: string;
    price: number;
    stockStatus: string;
    quantity?: number | null;
    coverImage?: string | null;
    images?: { url: string }[];
  };
  size?: "sm" | "md" | "lg";
  showQuantity?: boolean;
}

export function AddToCartButton({ product, size = "md", showQuantity = false }: AddToCartButtonProps) {
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  const outOfStock = product.stockStatus !== "in_stock";
  const maxQty = product.quantity ?? 99;
  const imageUrl = product.coverImage ?? product.images?.[0]?.url ?? null;

  const handleAdd = () => {
    addItem(
      {
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        sku: product.sku,
        price: product.price,
        imageUrl,
        stockStatus: product.stockStatus,
        maxQuantity: maxQty,
      },
      qty
    );
    setQty(1);
  };

  if (outOfStock) {
    return (
      <Button variant="secondary" size={size} disabled className="w-full">
        Немає в наявності
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showQuantity && (
        <QuantitySelector value={qty} onChange={setQty} min={1} max={maxQty} />
      )}
      <Button onClick={handleAdd} size={size} className="w-full gap-2">
        <ShoppingCart className="h-4 w-4" />
        Купити
      </Button>
    </div>
  );
}
