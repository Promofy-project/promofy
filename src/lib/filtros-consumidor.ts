/**
 * Filtros de descoberta do consumidor (além da taxonomia).
 *
 * Cidade/bairro vêm de dados REAIS do estabelecimento — não de lista
 * hardcoded. Tipo de promoção é o enum explícito. Consumo reusa
 * formas_consumo. Mínimo: slider; extremo = sem limite (não filtra).
 *
 * lat/lng do consumidor NUNCA entram na URL.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

import { ehTipoPromocao, type TipoPromocaoId } from "./tipo-promocao";
import type { FormaConsumoId } from "./cupom-campos";
import { FORMAS_CONSUMO } from "./cupom-campos";

export const SENTINELA_MIN_SEM_LIMITE = 9999;

export interface ExtraBusca {
  dia?: string;
  base?: string;
  cidade?: string;
  bairro?: string;
  promo?: string;
  consumo?: string;
  min?: string;
  perto?: string;
  trilho?: string;
}

export type TrilhoDescoberta = "novos" | "alta" | "populares" | "unidades";

export interface FiltroConsumidor {
  cidade?: string;
  bairro?: string;
  tipoPromocao?: TipoPromocaoId;
  consumo?: FormaConsumoId;
  /** undefined = sem filtro; SENTINELA_MIN_SEM_LIMITE = sem limite */
  minCompra?: number;
  perto?: boolean;
  trilho?: TrilhoDescoberta;
}

const FORMAS = new Set<string>(FORMAS_CONSUMO.map((f) => f.id));
const TRILHOS = new Set<string>(["novos", "alta", "populares", "unidades"]);

function limpar(valor: string | undefined): string | undefined {
  if (typeof valor !== "string") return undefined;
  const t = valor.trim();
  return t || undefined;
}

export function filtroConsumidorDeQuery(sp?: {
  cidade?: string | string[];
  bairro?: string | string[];
  promo?: string | string[];
  consumo?: string | string[];
  min?: string | string[];
  perto?: string | string[];
  trilho?: string | string[];
}): FiltroConsumidor {
  const primeiro = (v: string | string[] | undefined): string | undefined => {
    const c = Array.isArray(v) ? v[0] : v;
    return limpar(typeof c === "string" ? c : undefined);
  };
  const cidade = primeiro(sp?.cidade);
  const bairro = primeiro(sp?.bairro);
  const promo = primeiro(sp?.promo);
  const consumo = primeiro(sp?.consumo);
  const minRaw = primeiro(sp?.min);
  const perto = primeiro(sp?.perto);
  const trilho = primeiro(sp?.trilho);

  let minCompra: number | undefined;
  if (minRaw === "sem-limite") minCompra = SENTINELA_MIN_SEM_LIMITE;
  else if (minRaw) {
    const n = Number(minRaw);
    if (Number.isFinite(n) && n >= 0) minCompra = n;
  }

  return {
    cidade,
    bairro,
    tipoPromocao: ehTipoPromocao(promo) ? promo : undefined,
    consumo: consumo && FORMAS.has(consumo) ? (consumo as FormaConsumoId) : undefined,
    minCompra,
    perto: perto === "1" || perto === "sim",
    trilho: trilho && TRILHOS.has(trilho) ? (trilho as TrilhoDescoberta) : undefined,
  };
}

export function extraDeFiltro(f: FiltroConsumidor, dia?: string): ExtraBusca {
  const extra: ExtraBusca = {};
  if (dia) extra.dia = dia;
  if (f.cidade) extra.cidade = f.cidade;
  if (f.bairro) extra.bairro = f.bairro;
  if (f.tipoPromocao) extra.promo = f.tipoPromocao;
  if (f.consumo) extra.consumo = f.consumo;
  if (f.minCompra === SENTINELA_MIN_SEM_LIMITE) extra.min = "sem-limite";
  else if (f.minCompra != null) extra.min = String(f.minCompra);
  if (f.perto) extra.perto = "1";
  if (f.trilho) extra.trilho = f.trilho;
  return extra;
}

export interface ItemFiltroCatalogo {
  cidade?: string | null;
  bairro?: string | null;
  tipoPromocao?: string | null;
  formasConsumo?: string[];
  valorCompraMinimo?: number | null;
}

export function passarFiltroConsumidor(
  item: ItemFiltroCatalogo,
  filtro: FiltroConsumidor,
): boolean {
  if (filtro.cidade && (item.cidade ?? "").trim() !== filtro.cidade.trim()) {
    return false;
  }
  if (filtro.bairro && (item.bairro ?? "").trim() !== filtro.bairro.trim()) {
    return false;
  }
  if (filtro.tipoPromocao && item.tipoPromocao !== filtro.tipoPromocao) {
    return false;
  }
  if (filtro.consumo) {
    const formas = item.formasConsumo ?? [];
    if (!formas.includes(filtro.consumo)) return false;
  }
  if (
    filtro.minCompra != null &&
    filtro.minCompra !== SENTINELA_MIN_SEM_LIMITE
  ) {
    const piso = item.valorCompraMinimo;
    if (piso != null && piso > filtro.minCompra) return false;
  }
  return true;
}

/** Locais distintos a partir do catálogo real — nenhuma lista paralela. */
export function locaisDoCatalogo(
  itens: { cidade?: string | null; bairro?: string | null }[],
): { cidades: string[]; bairrosPorCidade: Record<string, string[]> } {
  const cidadesSet = new Set<string>();
  const mapa = new Map<string, Set<string>>();
  for (const i of itens) {
    const c = (i.cidade ?? "").trim();
    if (!c) continue;
    cidadesSet.add(c);
    const b = (i.bairro ?? "").trim();
    if (!b) continue;
    let set = mapa.get(c);
    if (!set) {
      set = new Set();
      mapa.set(c, set);
    }
    set.add(b);
  }
  const cidades = Array.from(cidadesSet).sort((a, b) => (a < b ? -1 : 1));
  const bairrosPorCidade: Record<string, string[]> = {};
  for (const c of cidades) {
    bairrosPorCidade[c] = Array.from(mapa.get(c) ?? []).sort((a, b) =>
      a < b ? -1 : 1,
    );
  }
  return { cidades, bairrosPorCidade };
}
