import Link from "next/link";
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
  href,
  ctaLabel = "Usar agora",
  economiaTone = "yellow",
  compact = false,
  showcase = false,
  className,
}: {
  cupom: Cupom;
  /** quando definido (e disponível), o card inteiro vira link para o detalhe */
  href?: string;
  ctaLabel?: string;
  /** cor da linha "Economize": yellow (landing) | blue (home Figma) */
  economiaTone?: "yellow" | "blue";
  /** meta compacta (rating · distância numa linha) usada na home; default mostra estabelecimento + distância */
  compact?: boolean;
  /** vitrine da landing: mantém o visual, mas troca o resgate por um CTA "Baixe o app" (→ /m) */
  showcase?: boolean;
  className?: string;
}) {
  const categoria = getCategoria(cupom.categoria);
  const indisponivel = cupom.status === "indisponivel";
  const linkable = Boolean(href) && !indisponivel && !showcase;

  return (
    <article
      className={cn(
        "group relative isolate flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      {/* stretched link — torna o card inteiro clicável (só quando disponível) */}
      {linkable && (
        <Link
          href={href!}
          aria-label={`Ver detalhes: ${cupom.titulo}`}
          className="absolute inset-0 z-[1]"
        />
      )}

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
          <Badge variant="yellow" className="absolute left-3 top-3 z-[2] shadow-sm">
            Oferta exclusiva
          </Badge>
        )}
        <FavoriteButton
          estabelecimentoId={cupom.estabelecimentoId}
          className="absolute right-3 top-3 z-[2]"
        />

        {indisponivel && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/55">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-danger">
              Indisponível
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className={cn("flex flex-1 flex-col gap-2", compact ? "p-3" : "p-4")}>
        <h3
          className={cn(
            "line-clamp-2 font-bold leading-snug",
            compact ? "text-sm" : "text-base",
          )}
        >
          {cupom.titulo}
        </h3>

        {compact ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StarRating rating={cupom.rating} />
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {formatDistance(cupom.distanciaKm)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{cupom.estabelecimento}</span>
              <span aria-hidden>·</span>
              <StarRating rating={cupom.rating} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {formatDistance(cupom.distanciaKm)}
            </div>
          </>
        )}

        {economiaTone === "blue" ? (
          <p
            className={cn(
              "mt-1 font-extrabold leading-tight text-primary",
              // device desktop (lg) tem cards estreitos de 390px → volta a text-xs
              compact ? "text-xs sm:text-sm lg:text-xs" : "text-sm",
            )}
          >
            Economize R$ {formatBRLValue(cupom.economia)} hoje!
          </p>
        ) : (
          <p className="mt-1 inline-flex w-fit items-center rounded-md bg-yellow-soft px-2 py-1 text-sm font-extrabold text-[#8a6d0b]">
            Economize R$ {formatBRLValue(cupom.economia)} hoje!
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Válido até {formatShortDate(cupom.validade)}
        </div>

        {showcase ? (
          /* Vitrine da landing: sem resgate — CTA leva ao app */
          <Button asChild variant="secondary" className="relative z-[2] mt-3 w-full">
            <Link href="/m">Baixe o app para resgatar</Link>
          </Button>
        ) : linkable ? (
          <Button asChild className="relative z-[2] mt-3 w-full">
            {/* visual/mouse apenas — o link acessível é o stretched link */}
            <Link href={href!} tabIndex={-1} aria-hidden>
              {ctaLabel}
            </Link>
          </Button>
        ) : (
          <Button
            className="relative z-[2] mt-3 w-full"
            disabled={indisponivel}
            variant={indisponivel ? "outline" : "default"}
          >
            {indisponivel ? "Indisponível" : ctaLabel}
          </Button>
        )}
      </div>
    </article>
  );
}
