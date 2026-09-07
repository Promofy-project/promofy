import type { CrmFiltro } from "./crm-tipos";

const FILTROS: readonly CrmFiltro[] = [
  "todos",
  "recentes",
  "recorrentes",
  "periodo_90d",
];

export const CRM_ORDENACAO_AUDIT = "ultimo_resgate_desc";

export interface CrmFiltrosAudit {
  tem_busca: boolean;
  filtro: CrmFiltro;
  ordenacao: typeof CRM_ORDENACAO_AUDIT;
}

function filtroAudit(raw: string | null | undefined): CrmFiltro {
  if (raw && (FILTROS as readonly string[]).includes(raw)) return raw as CrmFiltro;
  return "todos";
}

/**
 * Metadados de exportação sem texto livre (nome/e-mail/telefone/fórmula).
 * `q` só vira flag booleana — nunca é persistido.
 */
export function filtrosAuditCrm(
  q: string | null | undefined,
  filtro: string | null | undefined,
): CrmFiltrosAudit {
  return {
    tem_busca: Boolean(q?.trim()),
    filtro: filtroAudit(filtro),
    ordenacao: CRM_ORDENACAO_AUDIT,
  };
}
