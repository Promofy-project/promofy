import type { Cupom, MetricasCupom, StatusCupomPortal } from "@/lib/types";

/**
 * Item de cupom na visão do portal.
 *
 * Fase 2: a lista do portal vem do banco (src/lib/data/cupons.ts →
 * buscarCuponsPortal). Este módulo mantém apenas o TIPO compartilhado
 * pelos componentes do portal; o antigo SEED_CUPONS_PORTAL em memória
 * foi removido (os cupons — inclusive as campanhas antigas — vivem no
 * seed do banco).
 */
export interface ItemCupomPortal {
  cupom: Cupom;
  statusPortal: StatusCupomPortal;
  metricas: MetricasCupom;
  /** limite total de resgates da campanha (para o status "esgotado") */
  limiteTotal: number;
  /** Fase 6: usos por cliente — `null` = ilimitado (vocabulário do banco). */
  limiteUsuario?: number | null;
  /** data de início da campanha */
  dataInicio?: string;
  /** ocultar o cupom até a data de início */
  ocultarAteInicio?: boolean;
  /**
   * Fase 6.5/C5: motivo da ÚLTIMA rejeição, derivado do histórico de
   * moderação. Só faz sentido com `statusPortal === "rejeitado"` — depois
   * do reenvio o cupom volta a 'pendente' e o motivo vira histórico.
   */
  motivoRejeicao?: string;
}
