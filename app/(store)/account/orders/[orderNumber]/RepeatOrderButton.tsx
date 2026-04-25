"use client";

import { useRouter } from "next/navigation";
import { useCartStore } from "@/hooks/useCart";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  items: Array<{ productId: string; name: string; quantity: number }>;
}

export function RepeatOrderButton({ items }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [loading, setLoading] = useState(false);

  const handleRepeat = async () => {
    setLoading(true);
    try {
      // Fetch current product data for each item
      for (const item of items) {
        const res = await fetch(`/api/products/${item.productId}`).catch(() => null);
        if (!res || !res.ok) continue;
        const data = await res.json();
        if (!data.success || !data.data) continue;
        const product = data.data;
        if (product.stockStatus !== "in_stock") continue;

        addItem({
          productId: product.id,
          productSlug: product.slug,
          name: product.name,
          sku: product.sku,
          price: product.price,
          imageUrl: product.images?.[0]?.url || null,
          stockStatus: product.stockStatus,
          maxQuantity: product.quantity ?? 99,
        }, item.quantity);
      }
      router.push("/checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleRepeat} className="gap-1">
      <RefreshCw className="h-4 w-4" /> Повторити замовлення
    </Button>
  );
}
