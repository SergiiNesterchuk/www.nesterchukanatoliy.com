"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartItem } from "./CartItem";
import { useCartStore } from "@/hooks/useCart";
import { formatPrice } from "@/shared/money";

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalPrice } = useCartStore();

  return (
    <Drawer open={isOpen} onClose={closeCart} title="Кошик">
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-12 w-12" />}
          title="Кошик порожній"
          description="Додайте товари з каталогу"
        />
      ) : (
        <>
          <div className="px-4 divide-y divide-gray-100">
            {items.map((item) => (
              <CartItem
                key={item.productId}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </div>

          <div className="sticky bottom-0 bg-white border-t px-4 py-4 space-y-3">
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Разом:</span>
              <span>{formatPrice(totalPrice())}</span>
            </div>
            <Link href="/checkout/" onClick={closeCart}>
              <Button size="lg" className="w-full">
                Оформити замовлення
              </Button>
            </Link>
          </div>
        </>
      )}
    </Drawer>
  );
}
