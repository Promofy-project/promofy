import { Star } from "lucide-react";

import type { Avaliacao } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function ReviewCard({
  avaliacao,
  className,
}: {
  avaliacao: Avaliacao;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials(avaliacao.usuario)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <figcaption className="truncate text-sm font-bold">
            {avaliacao.usuario}
          </figcaption>
          <p className="text-xs text-muted-foreground">
            {formatShortDate(avaliacao.data)}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < avaliacao.rating
                  ? "fill-yellow text-yellow"
                  : "fill-muted text-muted",
              )}
            />
          ))}
        </div>
      </div>

      <blockquote className="text-sm leading-relaxed text-foreground">
        “{avaliacao.comentario}”
      </blockquote>

      <Badge variant="muted" className="w-fit">
        {avaliacao.estabelecimento}
      </Badge>
    </figure>
  );
}
