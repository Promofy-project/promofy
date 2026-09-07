/**
 * Textos de capacidade e prova social do cupom — módulo puro.
 *
 * Sem `server-only`, sem DOM, sem `Intl`. Dois números distintos:
 *   disponíveis = limite_total − ocupados (ocupados = validado + ativo vigente);
 *   resgates    = só validações confirmadas.
 *
 * Ilimitado não ganha "∞" nem urgência falsa.
 */

export const COPY_CONFIRMAR_PAUSA =
  "Pausar este cupom impede novas ativações. Quem já ativou continua " +
  "podendo utilizá-lo enquanto o código estiver válido.";

export const COPY_REATIVAR_HISTORICO =
  "A campanha anterior e seu histórico serão preservados.";

export function textoDisponibilidade(
  limiteTotal: number | null | undefined,
  disponiveis: number | null | undefined,
): string | null {
  if (limiteTotal == null || disponiveis == null) return null;
  return `${disponiveis} disponíveis de ${limiteTotal}`;
}

export function textoResgates(n: number | null | undefined): string | null {
  const qtd = Math.max(0, n ?? 0);
  if (qtd <= 0) return null;
  return qtd === 1 ? "1 resgate realizado" : `${qtd} resgates realizados`;
}
