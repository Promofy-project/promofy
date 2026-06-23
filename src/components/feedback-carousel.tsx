"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

import type { Avaliacao } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function FeedbackCarousel({ items }: { items: Avaliacao[] }) {
  const [index, setIndex] = React.useState(0);
  if (items.length === 0) return null;

  const a = items[index];
  const go = (dir: number) =>
    setIndex((i) => (i + dir + items.length) % items.length);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Anterior"
        onClick={() => go(-1)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <figure className="min-w-0 flex-1 rounded-card border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials(a.usuario)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <figcaption className="truncate text-sm font-bold">
              {a.usuario}
            </figcaption>
            <p className="text-xs text-muted-foreground">
              {formatShortDate(a.data)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i < a.rating
                    ? "fill-yellow text-yellow"
                    : "fill-muted text-muted",
                )}
              />
            ))}
          </div>
        </div>
        <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
          “{a.comentario}”
        </blockquote>
      </figure>

      <button
        type="button"
        aria-label="Próximo"
        onClick={() => go(1)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
