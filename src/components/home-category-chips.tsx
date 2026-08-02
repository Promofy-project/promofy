import Link from "next/link";
import { ArrowDownUp } from "lucide-react";

import type { CategoriaFiltro } from "@/lib/data/categorias";
import { cn } from "@/lib/utils";

/**
 * Chips de categoria da home — agora FILTRAM de verdade (backlog 12.3).
 *
 * Antes: seis rótulos literais (`alimentação, lazer, compras, serviços,
 * saúde, beleza`), dos quais QUATRO não existem no banco, e um
 * `React.useState` local cujo onClick só trocava a cor do próprio chip.
 * Observado no ar: com "Beleza" em aria-pressed="true", os 6 cupons
 * continuaram na tela, incluindo os de alimentação.
 *
 * Agora: as categorias vêm da tabela `categorias` e o chip é um LINK para
 * `/m?cat=<id>`. Sem estado de cliente — o chip ativo sai da própria URL e
 * quem filtra é a consulta no servidor (buscarCuponsHome). Isso também é o
 * que o app nativo reaproveita: lá não há query string, mas o contrato
 * "categoria entra na consulta" é o mesmo.
 *
 * Server component (nenhum "use client"): é só marcação e links.
 */
export function HomeCategoryChips({
  categorias,
  ativa,
}: {
  categorias: CategoriaFiltro[];
  /** id da categoria selecionada, já saneado contra a tabela. */
  ativa?: string;
}) {
  if (categorias.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {categorias.map((c) => {
        const selected = ativa === c.id;
        return (
          <Link
            key={c.id}
            // clicar no chip ativo limpa o filtro
            href={selected ? "/m" : `/m?cat=${c.id}`}
            scroll={false}
            aria-pressed={selected}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              selected
                ? "bg-[#E6A700] text-white"
                : "bg-yellow text-yellow-foreground hover:brightness-95",
            )}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {c.label}
          </Link>
        );
      })}
    </div>
  );
}
