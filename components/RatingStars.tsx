"use client";

import { FiStar } from "react-icons/fi";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number | null;
  reviewCount?: number;
  size?: "sm" | "md";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function RatingStars({
  rating,
  reviewCount,
  size = "sm",
  interactive,
  onChange,
}: RatingStarsProps) {
  const value = rating ?? 0;
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-6 w-6";

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            className={cn(!interactive && "cursor-default", interactive && "p-0.5")}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <FiStar
              className={cn(
                starSize,
                star <= Math.round(value)
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-300"
              )}
            />
          </button>
        ))}
      </span>
      {rating !== null && rating !== undefined && (
        <span className={cn("font-medium text-slate-700", size === "sm" ? "text-xs" : "text-sm")}>
          {Number(value).toFixed(1)}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className="text-xs text-slate-400">({reviewCount})</span>
      )}
    </span>
  );
}
