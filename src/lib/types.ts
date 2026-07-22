// ============================================================
// Promofy — domain types (protótipo, dados 100% mockados)
// ============================================================

export type CategoriaId =
  | "alimentacao"
  | "fitness"
  | "beleza"
  | "eletronicos"
  | "educacao"
  | "pet";

export type CupomStatus = "ativo" | "indisponivel";

export interface Categoria {
  id: CategoriaId;
  label: string;
  /** lucide-react icon name, mapped to a component in the UI layer */
  icon: string;
  /** CSS gradient used for image placeholders + chips */
  gradiente: string;
}

export interface Cupom {
  id: string;
  titulo: string;
  estabelecimento: string;
  estabelecimentoId: string;
  categoria: CategoriaId;
  economia: number; // R$ economizado
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

/** Status de um cupom na visão do lojista. */
export type StatusCupomPortal =
  | "ativo"
  | "expirado"
  | "esgotado"
  | "pendente"
  | "rejeitado";

export interface SerieMensal {
  mes: string;
  valor: number;
}
