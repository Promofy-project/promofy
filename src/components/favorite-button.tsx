"use client";

import * as React from "react";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

export function FavoriteButton({
  defaultActive = false,
  className,
}: {
  defaultActive?: boolean;
  className?: string;
}) {
  const [active, setActive] = React.useState(defaultActive);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive((v) => !v);
      }}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur transition hover:scale-105 active:scale-95",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors",
          active ? "fill-danger text-danger" : "text-muted-foreground",
        )}
      />
    </button>
  );
}
