/**
 * Trilhos de descoberta do consumidor — critérios explícitos, sem mock.
 *
 * K1 Novos do dia: publicado no calendário America/Sao_Paulo (YYYY-MM-DD
 *    já convertido pelo caller — este módulo não usa Intl).
 * K2 Em alta: resgates confirmados (`validacao`) nos últimos 7 dias;
 *    se zero, ativações válidas no mesmo período. Sem nota inventada.
 * K3 Populares na região: mesmo sinal de K2, restrito a cidade/bairro.
 *    Sem contexto regional → lista vazia (não finge popularidade local).
 * K4 Últimas unidades: só cupom COM limite_total; ilimitado nunca ganha
 *    selo de escassez.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

export const LIMIAR_ESCASSEZ = 10;

export interface SinalEventos {
  validacoes7d: number;
  ativacoes7d: number;
}

/** Score de "em alta": resgates confirmados, senão ativações. */
export function scoreEmAlta(sinal: SinalEventos): number {
  const v = Math.max(0, sinal.validacoes7d);
  if (v > 0) return v;
  return Math.max(0, sinal.ativacoes7d);
}

export function ehNovoDoDia(
  publicadoYmd: string | null | undefined,
  hojeYmd: string,
): boolean {
  if (!publicadoYmd || !hojeYmd) return false;
  return publicadoYmd === hojeYmd;
}

/**
 * Escassez real. `limiteTotal == null` = ilimitado → nunca.
 * `restantes == null` sem limite também nunca (dado incompleto ≠ escassez).
 */
export function ehEscassez(
  limiteTotal: number | null | undefined,
  restantes: number | null | undefined,
  limiar = LIMIAR_ESCASSEZ,
): boolean {
  if (limiteTotal == null) return false;
  if (restantes == null) return false;
  return restantes > 0 && restantes <= limiar;
}

export function restantesDe(
  limiteTotal: number | null | undefined,
  consumidos: number | null | undefined,
): number | null {
  if (limiteTotal == null) return null;
  const uso = Math.max(0, consumidos ?? 0);
  return Math.max(0, limiteTotal - uso);
}

export interface ItemRegiao {
  cidade?: string | null;
  bairro?: string | null;
}

export function noContextoRegional(
  item: ItemRegiao,
  cidade?: string,
  bairro?: string,
): boolean {
  if (!cidade && !bairro) return false;
  if (cidade && (item.cidade ?? "").trim() !== cidade.trim()) return false;
  if (bairro && (item.bairro ?? "").trim() !== bairro.trim()) return false;
  return true;
}

export function compararEmAlta(
  a: SinalEventos,
  b: SinalEventos,
): number {
  const sa = scoreEmAlta(a);
  const sb = scoreEmAlta(b);
  return sb - sa;
}
