import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CategoriaVisual } from "@/lib/categoria-visual";
import { gradienteWeb } from "@/lib/tema-visual";

/**
 * MARCO 2A — a ÚNICA porta do app para a taxonomia física.
 *
 * A TX-P2A criou esta fronteira exatamente para o dia de hoje: o runtime
 * nunca falou com `public.categorias`, falou com views. O cutover troca
 * QUAIS views, e nenhuma tela precisou mudar de novo. As três novas:
 *
 *   catalogo_segmentos   → os 14 segmentos ATIVOS (chips de descoberta)
 *   catalogo_folhas      → as 75 folhas ATRIBUÍVEIS (o que se pode ligar
 *                          a um cupom/estabelecimento AGORA)
 *   folha_para_segmento  → folha → segmento + visual, SEM filtro de
 *                          `ativo` (histórico)
 *
 * A colisão semântica que a TX-P2AF corrigiu agora é real, não hipotética:
 * `catalogo_segmentos` tem 14 linhas e `catalogo_folhas` tem 75. Um admin
 * recebendo segmento onde precisa de UUID de folha é o bug que este
 * módulo existe para impedir — por isso os nomes continuam deliberadamente
 * compridos, e um `buscarCategorias()` genérico segue proibido.
 *
 * `tema` → `gradiente` é resolvido AQUI. O banco guarda token e nunca CSS
 * (ver src/lib/tema-visual.ts); a UI continua recebendo `CategoriaVisual`
 * com a mesma forma de sempre, e por isso nenhum card, avatar ou chip
 * mudou uma linha no cutover.
 */

// ============================================================
// Descoberta pública (catalogo_segmentos + folha_para_segmento)
// ============================================================

export interface FiltroTaxonomia {
  /** Segmentos ATIVOS, na ordem de produto. Também é a fonte do visual dos chips. */
  catalogo: CategoriaVisual[];
  /** Slug do SEGMENTO que representa esta folha na descoberta. */
  filtroSlugDe(categoriaId: string): string | undefined;
  /**
   * UUIDs das folhas que um segmento representa — o predicado da consulta.
   *
   * NÃO filtra `ativo`: um cupom vivo numa folha desativada depois continua
   * aparecendo sob o chip do seu segmento. `ativo` governa NOVA SELEÇÃO,
   * não o que já existe (ver o contrato da TX-P2B).
   */
  idsFisicosDoFiltro(filtroSlug: string): string[];
  /**
   * Visual RESOLVIDO de uma folha — inclusive desativada.
   *
   * Existe porque `catalogo` filtra `ativo` e o histórico não pode: sem
   * isto, desativar uma categoria mandaria todo card existente dela para o
   * fallback cinza, em silêncio e sem erro nenhum.
   */
  visualDe(categoriaId: string): CategoriaVisual | undefined;
}

/**
 * Lê as duas views em paralelo (duas consultas por render, de tabela
 * pequena — não há N+1: nada aqui roda por card ou por linha).
 *
 * Banco fora do ar → catálogo vazio e mapas vazios, mesma degradação
 * tolerante de sempre: a faixa de chips some, a tela não quebra.
 */
export async function buscarFiltrosTaxonomia(): Promise<FiltroTaxonomia> {
  const supabase = createClient();

  const [segmentos, folhas] = await Promise.all([
    supabase
      .from("catalogo_segmentos")
      .select("slug, nome, icone, tema")
      .order("ordem", { ascending: true }),
    supabase
      .from("folha_para_segmento")
      .select("categoria_id, nome, segmento_slug, icone, tema"),
  ]);

  // Colunas voltam anuláveis porque o gerador não infere NOT NULL através
  // de uma view. Linha incompleta é descartada em vez de virar chip sem
  // label ou visual vazio — o catálogo prefere encolher a mentir.
  const catalogo: CategoriaVisual[] = segmentos.error
    ? []
    : (segmentos.data ?? []).flatMap((s) =>
        s.slug && s.nome && s.icone && s.tema
          ? [{ id: s.slug, label: s.nome, icon: s.icone, gradiente: gradienteWeb(s.tema) }]
          : [],
      );

  const porFolha = new Map<string, string>();
  const porSegmento = new Map<string, string[]>();
  const visualPorFolha = new Map<string, CategoriaVisual>();
  if (!folhas.error) {
    for (const f of folhas.data ?? []) {
      if (!f.categoria_id || !f.segmento_slug) continue;
      porFolha.set(f.categoria_id, f.segmento_slug);
      const atual = porSegmento.get(f.segmento_slug);
      if (atual) atual.push(f.categoria_id);
      else porSegmento.set(f.segmento_slug, [f.categoria_id]);
      if (f.nome && f.icone && f.tema) {
        visualPorFolha.set(f.categoria_id, {
          id: f.categoria_id,
          label: f.nome,
          icon: f.icone,
          gradiente: gradienteWeb(f.tema),
        });
      }
    }
  }

  return {
    catalogo,
    filtroSlugDe: (id) => porFolha.get(id),
    idsFisicosDoFiltro: (slug) => porSegmento.get(slug) ?? [],
    visualDe: (id) => visualPorFolha.get(id),
  };
}

// ============================================================
// Catálogo operacional (catalogo_folhas / folha_para_segmento)
// ============================================================

/**
 * As folhas que podem ser ATRIBUÍDAS agora — o que o form de cupom
 * oferece e o que o admin pode vincular a um estabelecimento.
 *
 * `id` aqui é o UUID da folha, o mesmo valor que trafega em
 * `cupons.categoria_nova_id` e `estabelecimento_categorias_novas.categoria_id`
 * — NUNCA o slug do segmento. É a distinção que a TX-P2AF comprou.
 *
 * Filtra `ativo` nos dois níveis (a view faz isso): é a lista do que pode
 * ser escolhido, e escolher uma folha inativa é justamente o que o
 * trigger `checar_categoria_nova_cupom` recusa no banco. Para RESOLVER o
 * visual de um dado que já existe (que pode apontar para folha
 * desativada), use `visualDe` de `buscarFiltrosTaxonomia`.
 *
 * Banco fora do ar → catálogo vazio, mesma tolerância do filtro.
 */
export async function buscarCatalogoFolhas(): Promise<CategoriaVisual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalogo_folhas")
    .select("categoria_id, nome, icone, tema, ordem, segmento_ordem")
    .order("segmento_ordem", { ascending: true })
    .order("ordem", { ascending: true });
  if (error) return [];
  return (data ?? []).flatMap((c) =>
    c.categoria_id && c.nome && c.icone && c.tema
      ? [
          {
            id: c.categoria_id,
            label: c.nome,
            icon: c.icone,
            gradiente: gradienteWeb(c.tema),
          },
        ]
      : [],
  );
}

/**
 * TODAS as folhas, ativas ou não — o catálogo de RESOLUÇÃO.
 *
 * É o que as telas de admin e portal precisam para traduzir o
 * `categoria_nova_id` de um cupom ou vínculo que JÁ existe em rótulo,
 * ícone e tema. Se filtrasse `ativo`, desativar uma categoria faria os
 * cupons dela aparecerem como "Categoria" cinza no painel de moderação —
 * um verde vazio na tela do moderador.
 *
 * Não confundir com `buscarCatalogoFolhas()`: aquele responde "o que se
 * pode escolher", este responde "o que isto é".
 */
export async function buscarCatalogoResolucao(): Promise<CategoriaVisual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("folha_para_segmento")
    .select("categoria_id, nome, icone, tema");
  if (error) return [];
  return (data ?? []).flatMap((c) =>
    c.categoria_id && c.nome && c.icone && c.tema
      ? [
          {
            id: c.categoria_id,
            label: c.nome,
            icon: c.icone,
            gradiente: gradienteWeb(c.tema),
          },
        ]
      : [],
  );
}
