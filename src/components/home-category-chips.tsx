import Link from "next/link";

import type { CategoriaVisual } from "@/lib/categoria-visual";
import { hrefBusca } from "@/lib/taxonomia-url";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

/**
 * Chips de SEGMENTO da home — 14 itens de `catalogo_segmentos`.
 *
 * Clique abre `/m/buscar?seg=<slug>`. Não filtra o grid da home: a
 * hierarquia mora na busca. Ícone + rótulo (o ícone nunca vai sozinho).
 */
export function HomeCategoryChips({
  categorias,
}: {
  categorias: CategoriaVisual[];
}) {
  if (categorias.length === 0) return null;

  return (
    <div
      role="navigation"
      aria-label="Segmentos"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1"
    >
      {categorias.map((c) => (
        <Link
          key={c.id}
          href={hrefBusca({ seg: c.id })}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-yellow px-3.5 py-2 text-sm font-semibold text-yellow-foreground transition-colors hover:brightness-95",
          )}
        >
          <Icon name={c.icon} className="h-3.5 w-3.5" aria-hidden />
          {c.label}
        </Link>
      ))}
    </div>
  );
}
