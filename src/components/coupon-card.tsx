import { MapPin, CalendarClock } from "lucide-react";

import type { Cupom } from "@/lib/types";
import { getCategoria } from "@/lib/mock-data";
import { cn, formatBRLValue, formatDistance, formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { StarRating } from "@/components/star-rating";
import { FavoriteButton } from "@/components/favorite-button";

export function CouponCard({
  cupom,
  className,
}: {
  cupom: Cupom;
  className?: string;
}) {
  const categoria = getCategoria(cupom.categoria);
  const indisponivel = cupom.status === "indisponivel";

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-36 w-full overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
          style={{ background: categoria.gradiente }}
        />
        <div className="bg-dots absolute inset-0 opacity-40" />
        <Icon
          name={categoria.icon}
          className="absolute -bottom-3 -right-2 h-28 w-28 text-white/25"
        />

        {cupom.destaque && (
          <Badge variant="yellow" className="absolute left-3 top-3 shadow-sm">
            Oferta exclusiva
          </Badge>
        )}
        <FavoriteButton className="absolute right-3 top-3" />

        {indisponivel && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/55">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-danger">
              Indisponível
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug">
          {cupom.titulo}
        </h3>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{cupom.estabelecimento}</span>
          <span aria-hidden>·</span>
          <StarRating rating={cupom.rating} />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {formatDistance(cupom.distanciaKm)}
        </div>

        <p className="mt-1 inline-flex w-fit items-center rounded-md bg-yellow-soft px-2 py-1 text-sm font-extrabold text-[#8a6d0b]">
          Economize R$ {formatBRLValue(cupom.economia)} hoje!
        </p>

        <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Válido até {formatShortDate(cupom.validade)}
        </div>

        <Button
          className="mt-3 w-full"
          disabled={indisponivel}
          variant={indisponivel ? "outline" : "default"}
        >
          {indisponivel ? "Indisponível" : "Usar agora"}
        </Button>
      </div>
    </article>
  );
}
