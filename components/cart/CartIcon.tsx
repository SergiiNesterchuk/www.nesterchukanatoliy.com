"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/hooks/useCart";
import { useEffect, useState } from "react";

export function CartIcon() {
  const totalItems = useCartStore((s) => s.totalItems);
  const openCart = useCartStore((s) => s.openCart);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const count = mounted ? totalItems() : 0;

  return (
    <button
      onClick={openCart}
      className="relative p-2 text-gray-700 hover:text-green-600 transition-colors"
      aria-label={`Кошик${count > 0 ? `, ${count} товарів` : ""}`}
    >
      <ShoppingCart className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-medium">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
