/** Tipos e helpers puros do CRM (sem server-only — usáveis no client). */

export type CrmFiltro = "todos" | "recentes" | "recorrentes" | "periodo_90d";

export interface CrmClienteResumo {
  usuarioId: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  nascimento: string | null;
  totalResgates: number;
  primeiroResgate: string | null;
  ultimoResgate: string | null;
}

export interface CrmResumo {
  clientesUnicos: number;
  novos30d: number;
  recorrentes: number;
  resgatesConfirmados: number;
}

export interface CrmHistoricoItem {
  cupomId: string;
  titulo: string;
  beneficio: string;
  economia: number | null;
  economiaVariavel: boolean;
  validadoEm: string | null;
  status: string;
  nps: number | null;
}

export interface CrmExportHistoricoItem extends CrmHistoricoItem {
  usuarioId: string;
  nome: string | null;
}

/** Texto honesto para campos ausentes na UI. */
export function crmCampoOuNaoInformado(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : "Não informado";
}
