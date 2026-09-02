/**
 * Consentimento versionável — não é um boolean solto.
 *
 * Recusar personalização NÃO impede o uso do Promofy: o ranking cai no
 * modo neutro. Coordenada do consumidor não mora aqui (fica no dispositivo).
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

export const FINALIDADE_PERSONALIZACAO = "personalizacao";
export const VERSAO_CONSENTIMENTO_PERSONALIZACAO = "1";

export interface ConsentimentoRegistro {
  finalidade: string;
  versao: string;
  concedidoEm: string | null;
  revogadoEm: string | null;
}

export function consentimentoAtivo(
  row: ConsentimentoRegistro | null | undefined,
  finalidade = FINALIDADE_PERSONALIZACAO,
  versao = VERSAO_CONSENTIMENTO_PERSONALIZACAO,
): boolean {
  if (!row) return false;
  if (row.finalidade !== finalidade) return false;
  if (row.versao !== versao) return false;
  if (!row.concedidoEm) return false;
  if (row.revogadoEm) return false;
  return true;
}
