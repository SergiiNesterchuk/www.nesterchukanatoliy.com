import { formatPrice } from "@/shared/money";
import { cn } from "@/shared/cn";

interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PriceDisplay({ price, compareAtPrice, className, size = "md" }: PriceDisplayProps) {
  const hasDiscount = compareAtPrice && compareAtPrice > price;

  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span
        className={cn("font-bold", {
          "text-sm": size === "sm",
          "text-lg": size === "md",
          "text-2xl": size === "lg",
          "text-red-600": hasDiscount,
        })}
      >
        {formatPrice(price)}
      </span>
      {hasDiscount && (
        <span className="text-gray-400 line-through text-sm">{formatPrice(compareAtPrice)}</span>
      )}
    </div>
  );
}
