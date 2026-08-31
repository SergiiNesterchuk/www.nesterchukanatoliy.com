"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartItem } from "./CartItem";
import { useCartStore } from "@/hooks/useCart";
import { formatPrice } from "@/shared/money";
import { MIN_ORDER_AMOUNT } from "@/shared/constants";

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalPrice } = useCartStore();
  const subtotal = totalPrice();
  const belowMinimum = subtotal < MIN_ORDER_AMOUNT;

  const safeUpdateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      const isLast = items.length === 1;
      if (isLast) {
        if (confirm("Видалити останній товар з корзини?")) {
          removeItem(productId);
        }
        return;
      }
      removeItem(productId);
      return;
    }
    updateQuantity(productId, qty);
  };

  const safeRemove = (productId: string) => {
    const isLast = items.length === 1;
    if (isLast) {
      if (confirm("Видалити останній товар з корзини?")) {
        removeItem(productId);
      }
      return;
    }
    removeItem(productId);
  };

  return (
    <Drawer open={isOpen} onClose={closeCart} title="Кошик">
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-12 w-12" />}
          title="Кошик порожній"
          description="Додайте товари з каталогу"
          action={
            <Link href="/katalog/" onClick={closeCart} className="text-green-600 hover:underline text-sm">
              Перейти до каталогу
            </Link>
          }
        />
      ) : (
        <>
          <div className="px-4 divide-y divide-gray-100">
            {items.map((item) => (
              <CartItem
                key={item.productId}
                item={item}
                onUpdateQuantity={safeUpdateQuantity}
                onRemove={safeRemove}
              />
            ))}
          </div>

          <div className="sticky bottom-0 bg-white border-t px-4 py-4 space-y-3">
            <Link href="/katalog/" onClick={closeCart} className="block text-center text-sm text-green-600 hover:underline">
              + Додати ще товари
            </Link>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Разом:</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {belowMinimum ? (
              <>
                <Button size="lg" className="w-full" disabled>
                  Оформити замовлення
                </Button>
                <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Мінімальна сума замовлення — {MIN_ORDER_AMOUNT / 100} грн
                </p>
              </>
            ) : (
              <Link href="/checkout/" onClick={closeCart}>
                <Button size="lg" className="w-full">
                  Оформити замовлення
                </Button>
              </Link>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
