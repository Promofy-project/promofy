import Link from "next/link";

import type { Cupom } from "@/lib/types";
import { getCategoria } from "@/lib/mock-data";
import { cn, formatBRLValue } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { FavoriteButton } from "@/components/favorite-button";

export function CouponListItem({
  cupom,
  href,
  className,
}: {
  cupom: Cupom;
  href?: string;
  className?: string;
}) {
  const categoria = getCategoria(cupom.categoria);
  const indisponivel = cupom.status === "indisponivel";

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-card border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      {href && (
        <Link
          href={href}
          aria-label={`Ver detalhes: ${cupom.titulo}`}
          className="absolute inset-0 z-[1]"
        />
      )}

      {/* Avatar / thumb */}
      <div
        className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl"
        style={{ background: categoria.gradiente }}
      >
        <Icon name={categoria.icon} className="h-6 w-6 text-white" />
      </div>

      {/* Texts */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">
          {cupom.titulo}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {cupom.estabelecimento}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs">
          <span className="font-bold text-foreground">
            Economize R$ {formatBRLValue(cupom.economia)}
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              indisponivel ? "text-danger" : "text-success",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                indisponivel ? "bg-danger" : "bg-success",
              )}
            />
            {indisponivel ? "Indisponível" : "Ativo"}
          </span>
        </p>
      </div>

      <FavoriteButton cupomId={cupom.id} className="relative z-[2] shadow-none" />
    </div>
  );
}
