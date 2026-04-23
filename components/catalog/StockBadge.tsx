import { cn } from "@/shared/cn";

interface StockBadgeProps {
  stockStatus: string;
  quantity?: number | null;
  className?: string;
}

export function StockBadge({ stockStatus, className }: StockBadgeProps) {
  const inStock = stockStatus === "in_stock";

  return (
    <span
      className={cn(
        "text-sm font-medium",
        inStock ? "text-green-600" : "text-gray-400",
        className
      )}
    >
      {inStock ? "В наявності" : "Немає в наявності"}
    </span>
  );
}
