import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CategoriaVisual } from "@/lib/categoria-visual";

/**
 * TX-P2A/TX-P2AF — a ÚNICA porta do app para a taxonomia física. O
 * runtime não fala mais com `public.categorias`: fala com três views de
 * fronteira, para que o cutover (TX-P2B/D) troque o CORPO delas —
 * categorias legado → segmentos + folhas — sem que nenhuma tela mude de
 * novo.
 *
 * A auditoria do TX-P2A achou uma colisão: uma função `buscarCategorias()`
 * genérica servia ao mesmo tempo o FILTRO público (vai virar segmento) e
 * a CATEGORIA operacional do admin/portal (vai virar folha). Hoje as duas
 * coincidem porque `categorias` é as duas coisas ao mesmo tempo — depois
 * do cutover não coincidem mais, e um admin recebendo segmento onde
 * precisa de UUID de folha é exatamente o bug que este módulo existe
 * para impedir. Por isso os nomes abaixo são deliberadamente compridos:
 *
 *   buscarFiltrosTaxonomia() → FILTRO de descoberta (/m, /m/buscar,
 *                              /m/filtros) + a tradução física→filtro
 *                              que buscarCuponsHome usa no predicado e no
 *                              visual do card.
 *   buscarCatalogoCategorias() → CATEGORIA operacional (admin edita o
 *                              vínculo estabelecimento↔categoria; portal
 *                              usa no form de cupom). Chave = categoria_id
 *                              FÍSICO, o mesmo que está em
 *                              cupons.categoria_id.
 *
 * Nunca reintroduzir um `buscarCategorias()` sem qualificação — é
 * exatamente o nome que já escondeu esta colisão uma vez.
 */

// ============================================================
// Filtro de descoberta (catalogo_filtros + categoria_para_filtro)
// ============================================================

export interface FiltroTaxonomia {
  /** Catálogo de filtros, na ordem de produto. Também é a fonte do visual. */
  catalogo: CategoriaVisual[];
  /** Slug do FILTRO que representa esta categoria física na descoberta. */
  filtroSlugDe(categoriaIdFisico: string): string | undefined;
  /**
   * Ids FÍSICOS que um filtro representa — o predicado da consulta.
   * Hoje devolve `[slug]` (identidade); após o cutover, todas as folhas
   * do segmento.
   */
  idsFisicosDoFiltro(filtroSlug: string): string[];
}

/**
 * Lê as duas views do filtro em paralelo (duas consultas por render, de
 * tabela pequena — não há N+1: nada aqui roda por card ou por linha).
 *
 * Banco fora do ar → catálogo vazio e mapas vazios, mesma degradação
 * tolerante de sempre: a faixa de chips some, a tela não quebra.
 */
export async function buscarFiltrosTaxonomia(): Promise<FiltroTaxonomia> {
  const supabase = createClient();

  const [filtros, mapa] = await Promise.all([
    supabase
      .from("catalogo_filtros")
      .select("slug, label, icon, gradiente")
      .order("ordem", { ascending: true }),
    supabase.from("categoria_para_filtro").select("categoria_id, filtro_slug"),
  ]);

  // Colunas voltam anuláveis porque o gerador não infere NOT NULL através
  // de uma view. Linha incompleta é descartada em vez de virar chip sem
  // label ou visual vazio — o catálogo prefere encolher a mentir.
  const catalogo: CategoriaVisual[] = filtros.error
    ? []
    : (filtros.data ?? []).flatMap((c) =>
        c.slug && c.label && c.icon && c.gradiente
          ? [{ id: c.slug, label: c.label, icon: c.icon, gradiente: c.gradiente }]
          : [],
      );

  const porFisico = new Map<string, string>();
  const porFiltro = new Map<string, string[]>();
  if (!mapa.error) {
    for (const r of mapa.data ?? []) {
      if (!r.categoria_id || !r.filtro_slug) continue;
      porFisico.set(r.categoria_id, r.filtro_slug);
      const atual = porFiltro.get(r.filtro_slug);
      if (atual) atual.push(r.categoria_id);
      else porFiltro.set(r.filtro_slug, [r.categoria_id]);
    }
  }

  return {
    catalogo,
    filtroSlugDe: (id) => porFisico.get(id),
    idsFisicosDoFiltro: (slug) => porFiltro.get(slug) ?? [],
  };
}

// ============================================================
// Catálogo operacional (catalogo_categorias)
// ============================================================

/**
 * As categorias FÍSICAS que podem ser ligadas a um estabelecimento ou
 * cupom — quem edita `estabelecimento_categorias` (admin) e quem
 * seleciona categoria num form de cupom (portal) precisa disto, NUNCA do
 * catálogo de filtros: `id` aqui é `categoria_id` físico, o mesmo valor
 * que trafega em `cupons.categoria_id` e
 * `estabelecimento_categorias.categoria_id` — não o slug de segmento.
 *
 * Banco fora do ar → catálogo vazio, mesma tolerância do filtro.
 */
export async function buscarCatalogoCategorias(): Promise<CategoriaVisual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalogo_categorias")
    .select("categoria_id, label, icon, gradiente")
    .order("ordem", { ascending: true });
  if (error) return [];
  return (data ?? []).flatMap((c) =>
    c.categoria_id && c.label && c.icon && c.gradiente
      ? [{ id: c.categoria_id, label: c.label, icon: c.icon, gradiente: c.gradiente }]
      : [],
  );
}
