import type { Cupom, MetricasCupom, StatusCupomPortal } from "@/lib/types";
import { cupons, metricasCupom } from "@/lib/mock-data";

/** Estabelecimento "logado" no portal. */
export const ESTABELECIMENTO_ID = "e1"; // Sabor & Cia

export interface ItemCupomPortal {
  cupom: Cupom;
  statusPortal: StatusCupomPortal;
  metricas: MetricasCupom;
  /** limite total de resgates da campanha (para o status "esgotado") */
  limiteTotal: number;
}

// Cupons reais do estabelecimento (e1) vindos do mock global — ativos.
const reais: ItemCupomPortal[] = cupons
  .filter((c) => c.estabelecimentoId === ESTABELECIMENTO_ID)
  .map((c) => ({
    cupom: c,
    statusPortal: "ativo" as StatusCupomPortal,
    metricas: metricasCupom[c.id] ?? {
      visualizacoes: 0,
      cliques: 0,
      ativacoes: 0,
      resgates: 0,
    },
    limiteTotal: 1000,
  }));

// Campanhas anteriores — existem só no portal (não entram no catálogo do /m).
const anteriores: ItemCupomPortal[] = [
  {
    cupom: {
      id: "p-campanha-esgotada",
      titulo: "Combo casal + 2 sobremesas",
      estabelecimento: "Sabor & Cia",
      estabelecimentoId: ESTABELECIMENTO_ID,
      categoria: "alimentacao",
      economia: 60,
      distanciaKm: 1.2,
      rating: 4.7,
      avaliacoes: 320,
      validade: "2026-08-10",
      status: "ativo",
      imagem: "",
      beneficio: "Para 2 pessoas, no jantar",
      regras: ["Válido no jantar, mediante reserva.", "Limite de 1 por mesa."],
      horarios: "Ter a Dom, 18h às 23h",
    },
    statusPortal: "esgotado",
    metricas: { visualizacoes: 2640, cliques: 980, ativacoes: 520, resgates: 500 },
    limiteTotal: 500,
  },
  {
    cupom: {
      id: "p-campanha-expirada",
      titulo: "Rodízio com 30% off (almoço)",
      estabelecimento: "Sabor & Cia",
      estabelecimentoId: ESTABELECIMENTO_ID,
      categoria: "alimentacao",
      economia: 28,
      distanciaKm: 1.2,
      rating: 4.6,
      avaliacoes: 210,
      validade: "2026-05-31",
      status: "ativo",
      imagem: "",
      beneficio: "Almoço de segunda a sexta",
      regras: ["Válido no almoço, dias úteis."],
      horarios: "Seg a Sex, 11h às 15h",
    },
    statusPortal: "expirado",
    metricas: { visualizacoes: 1870, cliques: 610, ativacoes: 240, resgates: 180 },
    limiteTotal: 800,
  },
];

export const SEED_CUPONS_PORTAL: ItemCupomPortal[] = [...reais, ...anteriores];
