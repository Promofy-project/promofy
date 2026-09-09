import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaVisual } from "@/lib/categoria-visual";
import { rotuloFolhaOuFallback } from "@/lib/categoria-visual";
import {
  buscarFiltrosTaxonomia,
  type FiltroTaxonomia,
} from "@/lib/data/taxonomia";

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
function hojeBrt(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Data (YYYY-MM-DD) de um timestamp ISO no fuso America/Sao_Paulo. */
function dataBrt(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export interface CategoriaEstab {
  id: string;
  label: string;
  segmentoSlug?: string;
  segmentoLabel?: string;
  /**
   * A folha (e o segmento dela) continuam ativos.
   *
   * MARCO 2A: `ativo` governa NOVA SELEÇÃO, nunca o histórico. Uma
   * categoria desativada depois continua vinculada ao estabelecimento e
   * continua sendo a categoria do cupom que já a usa — ela só deixa de
   * ser escolhível. Quem consome esta lista decide o que fazer com a
   * flag: o form de criação esconde as inativas, o de edição mantém a
   * ATUAL visível (senão o campo ficaria sem rótulo), e o admin mostra
   * todas para poder desvincular.
   */
  ativo: boolean;
}

/**
 * Categorias do estabelecimento — as FOLHAS (uuid) da junção nova, com a
 * principal primeiro (pré-seleção dos forms de cupom).
 *
 * Lojista lê as próprias via RLS mesmo com estabelecimento pendente ou
 * suspenso (policy "dono e admin leem", migration 20260831120000) — é o
 * que faz `/e/cupom/novo` funcionar antes da aprovação.
 *
 * Os rótulos vêm de `folha_para_segmento`, que NÃO filtra `ativo`: se
 * viessem de `catalogo_folhas`, uma categoria desativada perderia o
 * rótulo e apareceria como o próprio uuid na tela.
 */
export async function buscarCategoriasEstab(
  estabId: string,
  principalId?: string | null,
): Promise<CategoriaEstab[]> {
  const supabase = createClient();
  const [{ data: vinculos }, { data: folhas }, { data: segmentos }] = await Promise.all([
    supabase
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", estabId),
    supabase
      .from("folha_para_segmento")
      .select("categoria_id, nome, slug, ativo, segmento_ativo, segmento_slug"),
    supabase.from("catalogo_segmentos").select("slug, nome"),
  ]);

  const nomeSeg = new Map(
    (segmentos ?? []).flatMap((s) =>
      s.slug && s.nome ? [[s.slug, s.nome] as const] : [],
    ),
  );

  const porId = new Map(
    (folhas ?? []).flatMap((f) =>
      f.categoria_id
        ? [
            [
              f.categoria_id,
              {
                nome: f.nome,
                ativo: Boolean(f.ativo && f.segmento_ativo),
                segmentoSlug: f.segmento_slug ?? undefined,
                segmentoLabel:
                  (f.segmento_slug && nomeSeg.get(f.segmento_slug)) ||
                  f.segmento_slug ||
                  undefined,
              },
            ] as const,
          ]
        : [],
    ),
  );

  const lista = (vinculos ?? []).map((r) => {
    const folha = porId.get(r.categoria_id);
    return {
      id: r.categoria_id,
      label: rotuloFolhaOuFallback(folha?.nome),
      ativo: folha?.ativo ?? false,
      segmentoSlug: folha?.segmentoSlug,
      segmentoLabel: folha?.segmentoLabel,
    };
  });
  lista.sort((a, b) =>
    a.id === principalId ? -1 : b.id === principalId ? 1 : a.label.localeCompare(b.label),
  );
  return lista;
}

export interface ResumoEstab {
  estabelecimento: { id: string; nome: string; status: string } | null;
  cuponsAtivos: number;
  resgatesHoje: number;
}

/**
 * Resumo operacional da home do /e: cupons ativos e resgates de HOJE
 * (fuso America/Sao_Paulo — coerente com hoje_brt() do banco; contar por
 * dia UTC mostraria número errado à noite no servidor da Vercel).
 * Sob a RLS do lojista (lê o próprio estabelecimento e os resgates dos
 * próprios cupons). Degrada para zeros se não houver estabelecimento.
 */
export async function buscarResumoEstab(): Promise<ResumoEstab> {
  const supabase = createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { estabelecimento: null, cuponsAtivos: 0, resgatesHoje: 0 };

  const { data: est } = await supabase
    .from("estabelecimentos")
    .select("id, nome, status")
    .eq("owner_id", uid)
    .maybeSingle();
  if (!est) return { estabelecimento: null, cuponsAtivos: 0, resgatesHoje: 0 };

  const { data: cupons } = await supabase
    .from("cupons")
    .select("id, status")
    .eq("estabelecimento_id", est.id);

  const ids = (cupons ?? []).map((c) => c.id);
  const cuponsAtivos = (cupons ?? []).filter((c) => c.status === "ativo").length;

  let resgatesHoje = 0;
  if (ids.length > 0) {
    const { data: usos } = await supabase
      .from("cupons_usuario")
      .select("validado_em")
      .in("cupom_id", ids)
      .eq("status", "validado")
      .not("validado_em", "is", null);
    const hoje = hojeBrt();
    resgatesHoje = (usos ?? []).filter(
      (u) => u.validado_em && dataBrt(u.validado_em) === hoje,
    ).length;
  }

  return {
    estabelecimento: { id: est.id, nome: est.nome, status: est.status },
    cuponsAtivos,
    resgatesHoje,
  };
}

function cidadeVisivel(valor: string | null | undefined): string | undefined {
  const t = valor?.trim();
  return t || undefined;
}

/** Estabelecimento visível na lista pública do consumidor. Sem rating. */
export interface EstabPublico {
  id: string;
  nome: string;
  cidade?: string;
  /** Folha principal (UUID). Só para o predicado de filtro — a UI não mostra. */
  folhaId: string;
  categoriaVisual?: CategoriaVisual;
}

/**
 * Lista pública: a mesma semântica da RLS `publico le ativos`, aplicada
 * no query. Sem o `.eq("status","ativo")`, admin/lojista logado veria
 * pendente/suspenso pela policy extra. Taxonomia pela folha principal
 * (`categoria_principal_id` + `visualDe`), nunca o legado `categoria_id`.
 */
export async function buscarEstabelecimentosPublicos(
  filtroJa?: FiltroTaxonomia,
): Promise<EstabPublico[]> {
  const supabase = createClient();
  const [{ data, error }, filtro] = await Promise.all([
    supabase
      .from("estabelecimentos")
      .select("id, nome, cidade, categoria_principal_id")
      .eq("status", "ativo")
      .order("nome", { ascending: true }),
    filtroJa ? Promise.resolve(filtroJa) : buscarFiltrosTaxonomia(),
  ]);
  if (error) {
    throw new Error(`Falha ao buscar estabelecimentos públicos: ${error.message}`);
  }

  return (data ?? []).map((e) => {
    const folhaId = e.categoria_principal_id ?? "";
    return {
      id: e.id,
      nome: e.nome,
      cidade: cidadeVisivel(e.cidade),
      folhaId,
      categoriaVisual: folhaId ? filtro.visualDe(folhaId) : undefined,
    };
  });
}

/**
 * Perfil público de UM estabelecimento (CLIENT-RETURNS-03).
 *
 * `null` quando o id não existe OU quando a RLS esconde — a página trata os
 * dois como 404, porque distinguir "não existe" de "existe mas está suspenso"
 * transformaria a rota num oráculo do cadastro do cliente.
 *
 * Sem `rating`: a coluna existe no schema mas é agregado herdado do protótipo,
 * e avaliação de estabelecimento é decisão de produto ainda aberta (ver
 * `/m/cupom/[id]`). Mostrar "4,8" aqui reintroduziria o número inventado que a
 * Fase 9/Z3 tirou do app.
 */
export interface EstabPerfilPublico {
  id: string;
  nome: string;
  cidade?: string;
  bairro?: string;
  logo: string;
  categoriaVisual?: CategoriaVisual;
}

export async function buscarEstabelecimentoPublico(
  id: string,
): Promise<EstabPerfilPublico | null> {
  const supabase = createClient();
  const [{ data }, filtro] = await Promise.all([
    supabase
      .from("estabelecimentos")
      .select("id, nome, cidade, bairro, logo, categoria_principal_id, status")
      .eq("id", id)
      .eq("status", "ativo")
      .maybeSingle(),
    buscarFiltrosTaxonomia(),
  ]);
  if (!data) return null;

  const folhaId = data.categoria_principal_id ?? "";
  return {
    id: data.id,
    nome: data.nome,
    cidade: cidadeVisivel(data.cidade),
    bairro: cidadeVisivel(data.bairro),
    logo: data.logo ?? "",
    categoriaVisual: folhaId ? filtro.visualDe(folhaId) : undefined,
  };
}

/** Estabelecimento do lojista autenticado — autoridade é a sessão, não a URL. */
export const buscarEstabelecimentoDaSessao = cache(
  async function buscarEstabelecimentoDaSessao(): Promise<{
    id: string;
    nome: string;
    cidade: string;
    bairro: string;
    latitude: number | null;
    longitude: number | null;
    status: string;
    categoriaPrincipalId: string | null;
    logo: string;
  } | null> {
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return null;

    const { data } = await supabase
      .from("estabelecimentos")
      .select("id, nome, cidade, bairro, latitude, longitude, status, categoria_principal_id, logo")
      .eq("owner_id", uid)
      .maybeSingle();
    if (!data) return null;

    return {
      id: data.id,
      nome: data.nome,
      cidade: data.cidade,
      bairro: data.bairro ?? "",
      latitude: data.latitude != null ? Number(data.latitude) : null,
      longitude: data.longitude != null ? Number(data.longitude) : null,
      status: data.status,
      categoriaPrincipalId: data.categoria_principal_id,
      logo: data.logo ?? "",
    };
  },
);
