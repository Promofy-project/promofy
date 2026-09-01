import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";

import { buscarEstabelecimentosPublicos, type EstabPublico } from "@/lib/data/estab";
import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import {
  filtroDeQuery,
  hrefBusca,
  idsParaConsulta,
  normalizarFiltroUrl,
  precisaCanonicalizar,
  queryPrecisaLimpeza,
} from "@/lib/taxonomia-url";
import {
  CATEGORIA_VISUAL_FALLBACK,
  rotuloHierarquico,
} from "@/lib/categoria-visual";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { FiltroTaxonomiaChips } from "@/components/filtro-taxonomia-chips";
import { FavoriteButton } from "@/components/favorite-button";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

const ORIGEM = "/m/estabelecimentos";

function EstabelecimentoCard({ e }: { e: EstabPublico }) {
  const categoria = e.categoriaVisual ?? CATEGORIA_VISUAL_FALLBACK;
  const rotulo = rotuloHierarquico(categoria.segmentoLabel, categoria.label);
  return (
    <article className="flex items-start gap-3 rounded-card border border-border bg-card p-3.5 shadow-card">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={{ background: categoria.gradiente }}
      >
        <Icon name={categoria.icon} className="h-6 w-6 text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold leading-snug">{e.nome}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{rotulo}</span>
          {e.cidade ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {e.cidade}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <FavoriteButton estabelecimentoId={e.id} />
    </article>
  );
}

export default async function EstabelecimentosPage({
  searchParams,
}: {
  searchParams?: { seg?: string | string[]; cat?: string | string[] };
}) {
  const filtroTax = await buscarFiltrosTaxonomia();
  const bruto = filtroDeQuery(searchParams);
  const filtro = normalizarFiltroUrl(bruto, filtroTax.catalogoUrl);

  if (precisaCanonicalizar(bruto, filtro) || queryPrecisaLimpeza(searchParams)) {
    redirect(hrefBusca(filtro, { base: ORIGEM }));
  }

  const todos = await buscarEstabelecimentosPublicos(filtroTax);
  const ids = idsParaConsulta(filtro, filtroTax.catalogoUrl);
  const lista =
    ids === null ? todos : todos.filter((e) => e.folhaId && ids.includes(e.folhaId));

  return (
    <div className="flex flex-col">
      <MobilePageHeader title="Estabelecimentos" back="/m" />

      <div className="border-b border-border px-4 py-2.5">
        {filtroTax.catalogo.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Não foi possível carregar os segmentos agora.
          </p>
        ) : (
          <FiltroTaxonomiaChips
            catalogo={filtroTax.catalogoUrl}
            filtro={filtro}
            base={ORIGEM}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
        {todos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum estabelecimento disponível no momento.
          </p>
        ) : lista.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum estabelecimento nesta categoria.
          </p>
        ) : (
          lista.map((e) => <EstabelecimentoCard key={e.id} e={e} />)
        )}
      </div>
    </div>
  );
}
