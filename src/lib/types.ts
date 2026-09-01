// ============================================================
// Promofy — domain types (protótipo, dados 100% mockados)
// ============================================================

import type { JanelaConsumo } from "@/lib/janela";
import type { CategoriaVisual } from "@/lib/categoria-visual";

export type { JanelaConsumo };

/**
 * Id de categoria — dado dinâmico do banco (tabela `categorias`), não mais
 * uma união fechada de 6 valores. TX-P1: o catálogo real pode crescer sem
 * exigir mudança de tipo aqui; quem precisa do visual (label/icon/gradiente)
 * usa `categoriaVisual` (abaixo) ou `resolverCategoriaVisual`.
 *
 * DÍVIDA EXPLÍCITA (TX-P2AF, agora REAL — MARCO 2A; Marco 3A não
 * reintroduziu o legado): em `Cupom.categoria` este valor é o slug do
 * SEGMENTO (`catalogo_segmentos`/`folha_para_segmento` — ver
 * src/lib/data/taxonomia.ts), NÃO a categoria FOLHA física do cupom.
 *
 * A folha viaja em `categoriaVisual` (cujo `id` é o uuid dela, e cujo
 * `label` é o nome específico — "Pizzaria", não "Alimentação"). O filtro
 * público `?seg=&cat=` resolve slug → UUID e consulta
 * `cupons.categoria_nova_id`. Quem precisa da folha usa
 * `categoriaVisual.id`; quem precisa do segmento usa este campo.
 */
export type CategoriaId = string;

export type CupomStatus = "ativo" | "indisponivel";

export interface Cupom {
  id: string;
  titulo: string;
  estabelecimento: string;
  estabelecimentoId: string;
  categoria: CategoriaId;
  /** R$ economizado. Fase 6: com `economiaVariavel`, é o MÍNIMO garantido. */
  economia: number;
  /** Fase 6: a economia é "a partir de" — o valor real pode ser maior. */
  economiaVariavel?: boolean;
  /** Fase 6: taxas que NÃO entram no benefício (ids de src/lib/cupom-campos). */
  taxas?: string[];
  /** Fase 6: onde o cupom vale (ids de src/lib/cupom-campos). Vazio = não informado. */
  formasConsumo?: string[];
  precoDe?: number;
  precoPor?: number;
  distanciaKm: number;
  rating: number; // 0–5
  avaliacoes: number;
  validade: string; // ISO date
  status: CupomStatus;
  imagem: string; // placeholder path (mock)
  beneficio: string; // linha curta de destaque
  regras: string[];
  horarios: string;
  /** Restrição de dias (Fase 4, labels de DIAS_SEMANA); ausente/vazio = todos os dias. */
  dias?: string[];
  /**
   * Janela de consumo estruturada (Fase 5) — dias + faixa de horário.
   * Espelha o que `ativar_cupom` checa no servidor. Só vem do BANCO: o
   * mock tem `horarios` como texto solto e não sabe dias/início/fim.
   */
  janela?: JanelaConsumo;
  /** Visual resolvido contra o catálogo real (icon+gradiente); ausência = usar CATEGORIA_VISUAL_FALLBACK. */
  categoriaVisual?: CategoriaVisual;
  /**
   * Prazo de ativação em horas (Fase 6; null no banco = o default de 5).
   *
   * Era deliberadamente OMITIDO daqui como "dado de operação, não de
   * vitrine". A Fase 9/QA mudou a justificativa: com `janela_alcance`
   * (migration 29) a admissão passou a depender do prazo, e sem ele a UI
   * teria de chutar 5h — num cupom de 8h ela esmaeceria o botão que o
   * servidor aceitaria, que é o "botão inerte" que a Fase 5 existiu para
   * matar. Só vem do BANCO; o mock não tem.
   */
  prazoAtivacaoHoras?: number;
  destaque?: boolean; // "Oferta exclusiva"
}

export interface Plano {
  id: string;
  nome: string;
  preco: number; // mensal
  periodo: string; // "/mês"
  descricao: string;
  beneficios: string[];
  destaque?: boolean; // plano em evidência
  bloqueado?: boolean; // VIP — em breve
  badge?: string;
  legenda?: string; // nota abaixo do botão (ex.: regra do plano VIP)
}

export interface Estabelecimento {
  id: string;
  nome: string;
  categoria: CategoriaId;
  /** Visual resolvido contra o catálogo real (icon+gradiente); ausência = usar CATEGORIA_VISUAL_FALLBACK. */
  categoriaVisual?: CategoriaVisual;
  cidade: string;
  rating: number;
  avaliacoes: number;
  cuponsAtivos: number;
  resgatesMes: number;
  status: "ativo" | "pendente" | "suspenso";
}

export interface Usuario {
  id: string;
  nome: string;
  cidade: string;
  pontos: number;
  economiaTotal: number;
  cuponsUsados: number;
  nivel: "Bronze" | "Prata" | "Ouro" | "Diamante";
}

export interface Avaliacao {
  id: string;
  usuario: string;
  rating: number;
  comentario: string;
  data: string; // ISO date
  estabelecimento: string;
}

export interface FunilEtapa {
  etapa: string;
  valor: number;
  cor: string;
}

/** Métricas de desempenho de um cupom (visão do estabelecimento, no /portal). */
export interface MetricasCupom {
  visualizacoes: number;
  cliques: number;
  ativacoes: number;
  resgates: number;
}

/**
 * Status de um cupom na visão do lojista.
 *
 * `excluido` (Fase 9/C4) só existe aqui: a policy pública filtra por
 * `status in ('ativo','indisponivel')`, então ele nunca chega às telas do
 * consumidor. Para o lojista precisa existir — é como ele encontra o que
 * arquivou.
 */
export type StatusCupomPortal =
  | "ativo"
  | "expirado"
  | "esgotado"
  | "pendente"
  | "rejeitado"
  | "excluido";

export interface SerieMensal {
  mes: string;
  valor: number;
}
