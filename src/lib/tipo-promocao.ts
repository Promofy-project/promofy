/**
 * Tipo de promoção — vocabulário canônico, explícito.
 *
 * NÃO se infere de título, descrição ou regex. O lojista escolhe; o
 * banco guarda o enum. Sem escolha, o default do schema é `desconto`
 * (tipo genérico), nunca uma adivinhação em runtime.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

export const TIPOS_PROMOCAO = [
  { id: "desconto", label: "Desconto" },
  { id: "leve_mais_pague_menos", label: "Leve mais, pague menos" },
  { id: "frete_gratis", label: "Frete grátis" },
] as const;

export type TipoPromocaoId = (typeof TIPOS_PROMOCAO)[number]["id"];

const IDS = new Set<string>(TIPOS_PROMOCAO.map((t) => t.id));

export function ehTipoPromocao(valor: unknown): valor is TipoPromocaoId {
  return typeof valor === "string" && IDS.has(valor);
}

export function sanearTipoPromocao(valor: unknown): TipoPromocaoId {
  return ehTipoPromocao(valor) ? valor : "desconto";
}

export function rotuloTipoPromocao(id: string | undefined): string | undefined {
  return TIPOS_PROMOCAO.find((t) => t.id === id)?.label;
}

/** null = sem mínimo. 0 ou inválido também vira null (não inventa piso). */
export function sanearValorCompraMinimo(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}
