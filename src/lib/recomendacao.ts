/**
 * Recomendação v1 — determinística, sem ML, sem serviço externo.
 *
 * Pesos explícitos (testáveis). Sem consentimento de personalização:
 * ranking NEUTRO (popularidade geral real + novidade). Não rotular
 * "Para você". Cold start (perfil vazio / sem histórico): cidade +
 * popularidade + novidade, sem afinidade inventada.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

import { ehNovoDoDia, scoreEmAlta, type SinalEventos } from "./descoberta";

export const PESOS_RECOMENDACAO = {
  categoriaEscolhida: 8,
  segmentoEscolhido: 5,
  favorito: 6,
  historicoResgate: 7,
  estabelecimentoVisitado: 3,
  atividadeRecente: 4,
  novidade: 2,
} as const;

export type ModoRanking = "personalizado" | "neutro";

export interface PerfilRecomendacao {
  segmentos: string[];
  categorias: string[];
}

export interface ItemRecomendacao {
  id: string;
  segmentoSlug: string;
  categoriaFolhaSlug?: string;
  categoriaFolhaId?: string;
  estabelecimentoId: string;
  cidade?: string | null;
  publicadoYmd?: string | null;
  eventos: SinalEventos;
  favorito: boolean;
  resgatadoPeloUsuario: boolean;
  visitadoPeloUsuario: boolean;
}

export interface ContextoRanking {
  consentimentoPersonalizacao: boolean;
  perfil: PerfilRecomendacao | null;
  hojeYmd: string;
  cidade?: string;
}

function temPerfil(p: PerfilRecomendacao | null): boolean {
  if (!p) return false;
  return p.segmentos.length > 0 || p.categorias.length > 0;
}

function temHistorico(item: ItemRecomendacao): boolean {
  return item.favorito || item.resgatadoPeloUsuario || item.visitadoPeloUsuario;
}

function popularidadeNorm(sinal: SinalEventos): number {
  const s = scoreEmAlta(sinal);
  if (s <= 0) return 0;
  return Math.min(1, Math.log1p(s) / Math.log1p(50));
}

export function pontuarItem(
  item: ItemRecomendacao,
  ctx: ContextoRanking,
): { pontos: number; modo: ModoRanking } {
  const novidade = ehNovoDoDia(item.publicadoYmd, ctx.hojeYmd) ? 1 : 0;
  const pop = popularidadeNorm(item.eventos);

  const usaPerfil =
    ctx.consentimentoPersonalizacao &&
    (temPerfil(ctx.perfil) || temHistorico(item));

  if (!usaPerfil) {
    let pontos =
      PESOS_RECOMENDACAO.atividadeRecente * pop +
      PESOS_RECOMENDACAO.novidade * novidade;
    if (ctx.cidade && (item.cidade ?? "").trim() === ctx.cidade.trim()) {
      pontos += 1;
    }
    return { pontos, modo: "neutro" };
  }

  const segs = new Set(ctx.perfil?.segmentos ?? []);
  const cats = new Set(ctx.perfil?.categorias ?? []);
  const catHit =
    (item.categoriaFolhaSlug && cats.has(item.categoriaFolhaSlug)) ||
    (item.categoriaFolhaId && cats.has(item.categoriaFolhaId));
  const segHit = segs.has(item.segmentoSlug);

  let pontos = 0;
  if (catHit) pontos += PESOS_RECOMENDACAO.categoriaEscolhida;
  if (segHit) pontos += PESOS_RECOMENDACAO.segmentoEscolhido;
  if (item.favorito) pontos += PESOS_RECOMENDACAO.favorito;
  if (item.resgatadoPeloUsuario) pontos += PESOS_RECOMENDACAO.historicoResgate;
  if (item.visitadoPeloUsuario) pontos += PESOS_RECOMENDACAO.estabelecimentoVisitado;
  pontos += PESOS_RECOMENDACAO.atividadeRecente * pop;
  pontos += PESOS_RECOMENDACAO.novidade * novidade;
  return { pontos, modo: "personalizado" };
}

/**
 * Ordenação estável: pontos desc, depois id asc. Determinística.
 */
export function ordenarRecomendacao<T extends ItemRecomendacao>(
  itens: T[],
  ctx: ContextoRanking,
): { item: T; pontos: number; modo: ModoRanking }[] {
  const ranqueados = itens.map((item) => {
    const r = pontuarItem(item, ctx);
    return { item, pontos: r.pontos, modo: r.modo };
  });
  ranqueados.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
  });
  return ranqueados;
}

export function rotuloTrilho(modo: ModoRanking, consentimento: boolean): string {
  if (consentimento && modo === "personalizado") return "Para você";
  return "Em destaque";
}
