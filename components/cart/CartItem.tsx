"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { formatPrice } from "@/shared/money";
import type { CartItem as CartItemType } from "@/entities/cart";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}

export function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  return (
    <div className="flex gap-3 py-3">
      {/* Image */}
      <Link href={`/${item.productSlug}/`} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/${item.productSlug}/`} className="text-sm font-medium text-gray-900 hover:text-green-600 line-clamp-2">
          {item.name}
        </Link>
        <div className="mt-1 text-sm font-semibold text-gray-900">
          {formatPrice(item.price * item.quantity)}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <QuantitySelector
            value={item.quantity}
            onChange={(qty) => onUpdateQuantity(item.productId, qty)}
            max={item.maxQuantity ?? 99}
            className="scale-90 origin-left"
          />
          <button
            onClick={() => onRemove(item.productId)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label={`Видалити ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
