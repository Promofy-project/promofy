import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  rating,
  count,
  className,
  size = "sm",
}: {
  rating: number;
  count?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold text-foreground",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
    >
      <Star
        className={cn(
          "fill-yellow text-yellow",
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      {rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
      {typeof count === "number" && (
        <span className="font-normal text-muted-foreground">
          ({count.toLocaleString("pt-BR")})
        </span>
      )}
    </span>
  );
}
