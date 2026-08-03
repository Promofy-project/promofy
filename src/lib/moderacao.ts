/**
 * Histórico de moderação do cupom (Fase 6.5/C5).
 *
 * O banco guarda um array jsonb append-only em `cupons.moderacao_historico`
 * — fora do `grant update`, então só as RPCs `security definer` e o trigger
 * de edição escrevem lá.
 *
 * Módulo PURO: sem "server-only", sem DOM, sem Intl. O app nativo lê o
 * mesmo jsonb da mesma coluna e reaproveita estas funções como estão.
 * Defensivo pelo mesmo motivo de `economiaDeJson`: formato inesperado vira
 * lista vazia, nunca exceção — um cupom não pode ficar impossível de
 * exibir porque o histórico veio torto.
 */

/** Ações registradas. String livre na leitura: valor novo não quebra a tela. */
export type AcaoModeracao =
  | "rejeitado"
  | "aprovado"
  | "reenviado"
  | "editado"
  | "editado_material";

export interface EntradaModeracao {
  em: string;
  acao: string;
  por: string | null;
  motivo: string | null;
}

/** jsonb → entradas válidas, na ordem em que o banco gravou (append-only). */
export function historicoDeJson(valor: unknown): EntradaModeracao[] {
  if (!Array.isArray(valor)) return [];
  const saida: EntradaModeracao[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const e = item as Record<string, unknown>;
    if (typeof e.acao !== "string" || typeof e.em !== "string") continue;
    saida.push({
      em: e.em,
      acao: e.acao,
      por: typeof e.por === "string" ? e.por : null,
      motivo: typeof e.motivo === "string" && e.motivo.trim() ? e.motivo.trim() : null,
    });
  }
  return saida;
}

/**
 * Motivo da rejeição VIGENTE — ou `undefined`.
 *
 * Exige `status === 'rejeitado'` de propósito: o histórico é append-only,
 * então o motivo de uma rejeição antiga continua lá depois de o lojista
 * corrigir e reenviar. Mostrá-lo num cupom já pendente ou aprovado seria
 * acusar o lojista de um problema que ele resolveu.
 */
export function motivoAtual(
  historico: unknown,
  status: string,
): string | undefined {
  if (status !== "rejeitado") return undefined;
  const entradas = historicoDeJson(historico);
  for (let i = entradas.length - 1; i >= 0; i--) {
    if (entradas[i].acao === "rejeitado" && entradas[i].motivo) {
      return entradas[i].motivo ?? undefined;
    }
  }
  return undefined;
}
