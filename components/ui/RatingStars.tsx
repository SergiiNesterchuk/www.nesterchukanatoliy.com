import { cn } from "@/shared/cn";

function pluralReviews(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return "відгуків";
  if (last === 1) return "відгук";
  if (last >= 2 && last <= 4) return "відгуки";
  return "відгуків";
}

interface RatingStarsProps {
  averageRating: number;
  reviewCount: number;
  showNumeric?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function RatingStars({
  averageRating,
  reviewCount,
  showNumeric = false,
  size = "sm",
  className,
}: RatingStarsProps) {
  if (reviewCount === 0) return null;

  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={cn("flex items-center gap-1.5", textSize, className)}
      aria-label={`Рейтинг ${averageRating.toFixed(1)} з 5 на основі ${reviewCount} ${pluralReviews(reviewCount)}`}
    >
      {/* 5 stars with partial fill */}
      <div className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.min(1, Math.max(0, averageRating - (star - 1)));
          return (
            <div key={star} className={`relative ${starSize}`}>
              {/* Empty star (background) */}
              <svg className={`${starSize} text-gray-200 absolute inset-0`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {/* Filled star (overlay with clip) */}
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg className={`${starSize} text-yellow-400`} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {showNumeric && (
        <span className="font-medium text-gray-700">{averageRating.toFixed(1)}</span>
      )}

      <span className="text-gray-400">
        {reviewCount} {pluralReviews(reviewCount)}
      </span>
    </div>
  );
}
