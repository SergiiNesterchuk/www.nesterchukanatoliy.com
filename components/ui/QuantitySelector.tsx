"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/shared/cn";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantitySelectorProps) {
  const decrease = () => {
    if (value > min) onChange(value - 1);
  };

  const increase = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className={cn("flex items-center border border-gray-300 rounded-lg", className)}>
      <button
        type="button"
        onClick={decrease}
        disabled={value <= min}
        className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Зменшити кількість"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="px-3 py-1 text-center min-w-[2.5rem] font-medium tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={increase}
        disabled={value >= max}
        className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Збільшити кількість"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
