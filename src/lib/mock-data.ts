import type {
  Avaliacao,
  Categoria,
  CategoriaId,
  Cupom,
  Estabelecimento,
  FunilEtapa,
  MetricasCupom,
  Plano,
  SerieMensal,
  Usuario,
} from "./types";

// ============================================================
// CATEGORIAS
// ============================================================
export const categorias: Categoria[] = [
  {
    id: "alimentacao",
    label: "Alimentação",
    icon: "UtensilsCrossed",
    gradiente: "linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)",
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: "Dumbbell",
    gradiente: "linear-gradient(135deg, #22C55E 0%, #0EA5A4 100%)",
  },
  {
    id: "beleza",
    label: "Beleza",
    icon: "Scissors",
    gradiente: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
  },
  {
    id: "eletronicos",
    label: "Eletrônicos",
    icon: "Smartphone",
    gradiente: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)",
  },
  {
    id: "educacao",
    label: "Educação",
    icon: "GraduationCap",
    gradiente: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  },
  {
    id: "pet",
    label: "Pet",
    icon: "PawPrint",
    gradiente: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  },
];

export const categoriaMap: Record<CategoriaId, Categoria> = categorias.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<CategoriaId, Categoria>,
);

export function getCategoria(id: CategoriaId): Categoria {
  return categoriaMap[id];
}

// ============================================================
// ESTABELECIMENTOS (6)
// ============================================================
export const estabelecimentos: Estabelecimento[] = [
  {
    id: "e1",
    nome: "Sabor & Cia",
    categoria: "alimentacao",
    cidade: "São Paulo, SP",
    rating: 4.8,
    avaliacoes: 1240,
    cuponsAtivos: 6,
    resgatesMes: 482,
    status: "ativo",
  },
  {
    id: "e2",
    nome: "PowerFit Academia",
    categoria: "fitness",
    cidade: "São Paulo, SP",
    rating: 4.7,
    avaliacoes: 890,
    cuponsAtivos: 4,
    resgatesMes: 311,
    status: "ativo",
  },
  {
    id: "e3",
    nome: "Studio Bella",
    categoria: "beleza",
    cidade: "Campinas, SP",
    rating: 4.9,
    avaliacoes: 654,
    cuponsAtivos: 5,
    resgatesMes: 268,
    status: "ativo",
  },
  {
    id: "e4",
    nome: "TechMais Eletrônicos",
    categoria: "eletronicos",
    cidade: "São Paulo, SP",
    rating: 4.4,
    avaliacoes: 2130,
    cuponsAtivos: 3,
    resgatesMes: 540,
    status: "pendente",
  },
  {
    id: "e5",
    nome: "Saber+ Cursos",
    categoria: "educacao",
    cidade: "Remoto / Online",
    rating: 4.8,
    avaliacoes: 412,
    cuponsAtivos: 7,
    resgatesMes: 196,
    status: "ativo",
  },
  {
    id: "e6",
    nome: "Mundo Pet",
    categoria: "pet",
    cidade: "Santo André, SP",
    rating: 4.7,
    avaliacoes: 738,
    cuponsAtivos: 4,
    resgatesMes: 224,
    status: "suspenso",
  },
];

export function getEstabelecimento(id: string): Estabelecimento | undefined {
  return estabelecimentos.find((e) => e.id === id);
}

// ============================================================
// CUPONS (12 — 2 por categoria)
// ============================================================
export const cupons: Cupom[] = [
  // Alimentação — Sabor & Cia
  {
    id: "c01",
    titulo: "Rodízio de pizza em dobro",
    estabelecimento: "Sabor & Cia",
    estabelecimentoId: "e1",
    categoria: "alimentacao",
    economia: 45,
    precoDe: 89.9,
    precoPor: 44.9,
    distanciaKm: 1.2,
    rating: 4.8,
    avaliacoes: 1240,
    validade: "2026-08-27",
    status: "ativo",
    imagem: "/img/cupons/c01.jpg",
    beneficio: "2 rodízios pelo preço de 1",
    regras: [
      "Válido para consumo no local, jantar.",
      "Não cumulativo com outras promoções.",
      "Necessário apresentar o cupom no caixa.",
    ],
    horarios: "Ter a Dom, 18h às 23h",
    destaque: true,
  },
  {
    id: "c02",
    titulo: "20% off no almoço executivo",
    estabelecimento: "Sabor & Cia",
    estabelecimentoId: "e1",
    categoria: "alimentacao",
    economia: 18,
    distanciaKm: 2.4,
    rating: 4.5,
    avaliacoes: 1240,
    validade: "2026-08-12",
    status: "ativo",
    imagem: "/img/cupons/c02.jpg",
    beneficio: "Prato + bebida + sobremesa",
    regras: ["Válido de segunda a sexta.", "Limite de 1 cupom por pessoa."],
    horarios: "Seg a Sex, 11h às 15h",
  },
  // Fitness — PowerFit
  {
    id: "c03",
    titulo: "1 mês grátis na matrícula",
    estabelecimento: "PowerFit Academia",
    estabelecimentoId: "e2",
    categoria: "fitness",
    economia: 99,
    precoDe: 199,
    precoPor: 99,
    distanciaKm: 0.8,
    rating: 4.7,
    avaliacoes: 890,
    validade: "2026-09-11",
    status: "ativo",
    imagem: "/img/cupons/c03.jpg",
    beneficio: "Plano anual com 1 mês cortesia",
    regras: [
      "Válido para novos alunos.",
      "Fidelidade mínima de 12 meses.",
      "Avaliação física inclusa.",
    ],
    horarios: "Seg a Sáb, 6h às 22h",
    destaque: true,
  },
  {
    id: "c04",
    titulo: "Aula de spinning 2x1",
    estabelecimento: "PowerFit Academia",
    estabelecimentoId: "e2",
    categoria: "fitness",
    economia: 30,
    distanciaKm: 3.1,
    rating: 4.3,
    avaliacoes: 890,
    validade: "2026-08-12",
    status: "indisponivel",
    imagem: "/img/cupons/c04.jpg",
    beneficio: "Traga um amigo sem custo",
    regras: ["Sujeito à lotação da turma.", "Agendamento prévio obrigatório."],
    horarios: "Seg, Qua e Sex, 19h",
  },
  // Beleza — Studio Bella
  {
    id: "c05",
    titulo: "Corte + escova com 40% off",
    estabelecimento: "Studio Bella",
    estabelecimentoId: "e3",
    categoria: "beleza",
    economia: 50,
    precoDe: 125,
    precoPor: 75,
    distanciaKm: 1.6,
    rating: 4.9,
    avaliacoes: 654,
    validade: "2026-08-22",
    status: "ativo",
    imagem: "/img/cupons/c05.jpg",
    beneficio: "Inclui hidratação expressa",
    regras: ["Mediante agendamento.", "Válido de terça a quinta."],
    horarios: "Ter a Sáb, 9h às 19h",
    destaque: true,
  },
  {
    id: "c06",
    titulo: "Dia de noiva com brinde",
    estabelecimento: "Studio Bella",
    estabelecimentoId: "e3",
    categoria: "beleza",
    economia: 120,
    distanciaKm: 4.2,
    rating: 4.6,
    avaliacoes: 654,
    validade: "2026-09-26",
    status: "ativo",
    imagem: "/img/cupons/c06.jpg",
    beneficio: "Pacote completo + acompanhante",
    regras: ["Reserva com 30 dias de antecedência.", "Sinal de 30%."],
    horarios: "Sob agendamento",
  },
  // Eletrônicos — TechMais
  {
    id: "c07",
    titulo: "Fone bluetooth com 35% off",
    estabelecimento: "TechMais Eletrônicos",
    estabelecimentoId: "e4",
    categoria: "eletronicos",
    economia: 140,
    precoDe: 399,
    precoPor: 259,
    distanciaKm: 2.0,
    rating: 4.4,
    avaliacoes: 2130,
    validade: "2026-08-17",
    status: "ativo",
    imagem: "/img/cupons/c07.jpg",
    beneficio: "Modelos selecionados",
    regras: ["Enquanto durarem os estoques.", "Garantia de 12 meses."],
    horarios: "Seg a Sáb, 10h às 22h",
  },
  {
    id: "c08",
    titulo: "Película + capa grátis na compra",
    estabelecimento: "TechMais Eletrônicos",
    estabelecimentoId: "e4",
    categoria: "eletronicos",
    economia: 60,
    distanciaKm: 5.0,
    rating: 4.2,
    avaliacoes: 2130,
    validade: "2026-08-12",
    status: "indisponivel",
    imagem: "/img/cupons/c08.jpg",
    beneficio: "Na compra de qualquer smartphone",
    regras: ["Instalação inclusa.", "1 brinde por aparelho."],
    horarios: "Seg a Sáb, 10h às 22h",
  },
  // Educação — Saber+
  {
    id: "c09",
    titulo: "Curso de inglês — 3 meses grátis",
    estabelecimento: "Saber+ Cursos",
    estabelecimentoId: "e5",
    categoria: "educacao",
    economia: 290,
    precoDe: 580,
    precoPor: 290,
    distanciaKm: 1.1,
    rating: 4.8,
    avaliacoes: 412,
    validade: "2026-10-11",
    status: "ativo",
    imagem: "/img/cupons/c09.jpg",
    beneficio: "Plano semestral com 3 meses extra",
    regras: ["Para novas matrículas.", "Material didático à parte."],
    horarios: "Acesso 24h (online)",
    destaque: true,
  },
  {
    id: "c10",
    titulo: "Mentoria de carreira 50% off",
    estabelecimento: "Saber+ Cursos",
    estabelecimentoId: "e5",
    categoria: "educacao",
    economia: 75,
    precoDe: 150,
    precoPor: 75,
    distanciaKm: 6.3,
    rating: 4.5,
    avaliacoes: 412,
    validade: "2026-09-01",
    status: "ativo",
    imagem: "/img/cupons/c10.jpg",
    beneficio: "Sessão individual de 1h",
    regras: ["Agendamento conforme disponibilidade.", "Online via vídeo."],
    horarios: "Seg a Sex, 9h às 18h",
  },
  // Pet — Mundo Pet
  {
    id: "c11",
    titulo: "Banho & tosa leve 2x1",
    estabelecimento: "Mundo Pet",
    estabelecimentoId: "e6",
    categoria: "pet",
    economia: 40,
    distanciaKm: 0.9,
    rating: 4.7,
    avaliacoes: 738,
    validade: "2026-08-22",
    status: "ativo",
    imagem: "/img/cupons/c11.jpg",
    beneficio: "Para cães de pequeno porte",
    regras: ["Mediante agendamento.", "Válido de segunda a quinta."],
    horarios: "Seg a Sáb, 8h às 18h",
    destaque: true,
  },
  {
    id: "c12",
    titulo: "Ração premium 25% off",
    estabelecimento: "Mundo Pet",
    estabelecimentoId: "e6",
    categoria: "pet",
    economia: 55,
    precoDe: 220,
    precoPor: 165,
    distanciaKm: 3.7,
    rating: 4.6,
    avaliacoes: 738,
    validade: "2026-09-06",
    status: "ativo",
    imagem: "/img/cupons/c12.jpg",
    beneficio: "Sacos de 15kg selecionados",
    regras: ["Limite de 2 unidades por cliente.", "Enquanto durar o estoque."],
    horarios: "Seg a Sáb, 8h às 18h",
  },
];

export function getCupom(id: string): Cupom | undefined {
  return cupons.find((c) => c.id === id);
}

export const cuponsEmDestaque = cupons.filter((c) => c.destaque);

/**
 * Métricas de desempenho por cupom (visão do estabelecimento no /portal).
 * Aditivo — não altera o tipo Cupom nem afeta /m, landing ou /admin.
 * Coerentes: visualizações > cliques > ativações > resgates.
 */
export const metricasCupom: Record<string, MetricasCupom> = {
  c01: { visualizacoes: 4820, cliques: 1960, ativacoes: 740, resgates: 482 },
  c02: { visualizacoes: 3110, cliques: 1180, ativacoes: 410, resgates: 233 },
};

// ============================================================
// PLANOS (4)
// ============================================================
export const planos: Plano[] = [
  {
    id: "basico",
    nome: "Básico",
    preco: 9.9,
    periodo: "/mês",
    descricao: "Para quem está começando a economizar.",
    beneficios: [
      "Até 5 cupons por mês",
      "Ofertas de estabelecimentos próximos",
      "Suporte por e-mail",
    ],
  },
  {
    id: "plus",
    nome: "Plus",
    preco: 19.9,
    periodo: "/mês",
    descricao: "O queridinho de quem usa cupom toda semana.",
    beneficios: [
      "Cupons ilimitados",
      "Ofertas exclusivas Plus",
      "Cashback de 2% em resgates",
      "Suporte prioritário",
    ],
    destaque: true,
    badge: "Mais popular",
  },
  {
    id: "familia",
    nome: "Família",
    preco: 29.9,
    periodo: "/mês",
    descricao: "Economia para até 4 perfis na mesma conta.",
    beneficios: [
      "Tudo do Plus",
      "Até 4 perfis na conta",
      "Cashback de 4% em resgates",
      "Cupons exclusivos para família",
    ],
  },
  {
    id: "vip",
    nome: "VIP",
    preco: 0,
    periodo: "",
    descricao: "Benefícios premium e atendimento concierge.",
    beneficios: [
      "Tudo do Família",
      "Concierge de ofertas",
      "Eventos e experiências exclusivas",
      "Cashback de 8% em resgates",
    ],
    bloqueado: true,
    badge: "Em breve",
  },
];

// Planos com os textos completos do Figma (usados na tela /m/planos).
// Mantido separado de `planos` para não alterar a landing.
export const planosMobile: Plano[] = [
  {
    id: "basico",
    nome: "Plano Básico",
    preco: 9.9,
    periodo: "/mês",
    descricao: "",
    beneficios: [
      "Acesso a todas as ofertas disponíveis na cidade",
      "Possibilidade de resgatar até 5 cupons por mês",
      "Participação no ranking de pontuação para premiações",
      "Notificações personalizadas de ofertas na sua região",
    ],
  },
  {
    id: "plus",
    nome: "Plano Plus",
    preco: 19.9,
    periodo: "/mês",
    descricao: "",
    beneficios: [
      "Acesso a todas as ofertas disponíveis na cidade e regiões próximas",
      "Cupons ilimitados por mês",
      "Participação no ranking de pontuação para premiações",
      "Notificações personalizadas de ofertas na sua região",
    ],
  },
  {
    id: "familia",
    nome: "Plano Família",
    preco: 29.9,
    periodo: "/mês",
    descricao: "",
    beneficios: [
      "Acesso a todas as ofertas para até 4 perfis cadastrados",
      "Cupons ilimitados por mês, compartilhados entre os membros",
      "Participação de todos os membros no ranking de pontuação",
      "Benefícios exclusivos como cupons bônus a cada 3 meses",
    ],
  },
  {
    id: "vip",
    nome: "Plano VIP",
    preco: 0,
    periodo: "",
    descricao: "",
    bloqueado: true,
    beneficios: [
      "Acesso antecipado às ofertas mais exclusivas",
      "Cupons ilimitados e sem restrições geográficas (cidades da mesma rede Promofy)",
      "Participação no ranking de pontuação para premiações (com pontuação dobrada)",
      "Convites para eventos e promoções especiais com parceiros",
    ],
    legenda:
      "Plano exclusivo — liberado apenas para membros convidados ou por conquista. Saiba mais.",
  },
];

// ============================================================
// USUÁRIOS — ranking (8)
// ============================================================
export const usuarios: Usuario[] = [
  { id: "u1", nome: "Mariana Alves", cidade: "São Paulo, SP", pontos: 9820, economiaTotal: 1340, cuponsUsados: 142, nivel: "Diamante" },
  { id: "u2", nome: "Rafael Souza", cidade: "Campinas, SP", pontos: 8710, economiaTotal: 1180, cuponsUsados: 128, nivel: "Diamante" },
  { id: "u3", nome: "Camila Ferreira", cidade: "Santo André, SP", pontos: 7640, economiaTotal: 990, cuponsUsados: 111, nivel: "Ouro" },
  { id: "u4", nome: "Lucas Pereira", cidade: "São Paulo, SP", pontos: 6520, economiaTotal: 870, cuponsUsados: 98, nivel: "Ouro" },
  { id: "u5", nome: "Beatriz Lima", cidade: "Guarulhos, SP", pontos: 5410, economiaTotal: 720, cuponsUsados: 84, nivel: "Ouro" },
  { id: "u6", nome: "Thiago Rocha", cidade: "Osasco, SP", pontos: 4380, economiaTotal: 610, cuponsUsados: 72, nivel: "Prata" },
  { id: "u7", nome: "Juliana Costa", cidade: "São Paulo, SP", pontos: 3260, economiaTotal: 450, cuponsUsados: 58, nivel: "Prata" },
  { id: "u8", nome: "Pedro Martins", cidade: "Diadema, SP", pontos: 2190, economiaTotal: 320, cuponsUsados: 41, nivel: "Bronze" },
];

/**
 * Usuário "logado" no app do consumidor (mock). É o mesmo que aparece no menu
 * lateral; usado na conferência de identidade do cupom ativo. CPF mascarado —
 * NUNCA um CPF real.
 */
export const usuarioAtual = {
  nome: "Lucas Orladi",
  cpfMascarado: "123.***.***-09",
} as const;

// ============================================================
// AVALIAÇÕES (6)
// ============================================================
export const avaliacoes: Avaliacao[] = [
  { id: "a1", usuario: "Mariana Alves", rating: 5, comentario: "Economizei mais de R$ 200 no primeiro mês. O app é viciante!", data: "2026-06-18", estabelecimento: "Sabor & Cia" },
  { id: "a2", usuario: "Rafael Souza", rating: 5, comentario: "Achei a academia perto de casa com 1 mês grátis. Recomendo demais.", data: "2026-06-15", estabelecimento: "PowerFit Academia" },
  { id: "a3", usuario: "Camila Ferreira", rating: 4, comentario: "Cupons fáceis de usar, só queria mais opções de beleza na minha região.", data: "2026-06-12", estabelecimento: "Studio Bella" },
  { id: "a4", usuario: "Lucas Pereira", rating: 5, comentario: "O resgate é instantâneo, mostrei no caixa e funcionou na hora.", data: "2026-06-09", estabelecimento: "TechMais Eletrônicos" },
  { id: "a5", usuario: "Beatriz Lima", rating: 4, comentario: "Plano Plus vale muito a pena pelo cashback. Já se pagou.", data: "2026-06-05", estabelecimento: "Saber+ Cursos" },
  { id: "a6", usuario: "Thiago Rocha", rating: 5, comentario: "Banho e tosa do meu cachorro saiu pela metade do preço. Top!", data: "2026-06-02", estabelecimento: "Mundo Pet" },
];

// ============================================================
// DADOS DE DASHBOARD — funil + séries + KPIs
// ============================================================
export const funilConversao: FunilEtapa[] = [
  { etapa: "Visitantes do app", valor: 18240, cor: "#1414DC" },
  { etapa: "Visualizaram cupom", valor: 9680, cor: "#3A3AE6" },
  { etapa: "Clicaram em “Usar agora”", valor: 4120, cor: "#7A7AEF" },
  { etapa: "Resgataram", valor: 2380, cor: "#FAC81E" },
];

export const receitaMensal: SerieMensal[] = [
  { mes: "Jan", valor: 42000 },
  { mes: "Fev", valor: 48500 },
  { mes: "Mar", valor: 51200 },
  { mes: "Abr", valor: 60800 },
  { mes: "Mai", valor: 72400 },
  { mes: "Jun", valor: 81900 },
];

export const resgatesMensais: SerieMensal[] = [
  { mes: "Jan", valor: 1280 },
  { mes: "Fev", valor: 1520 },
  { mes: "Mar", valor: 1740 },
  { mes: "Abr", valor: 1980 },
  { mes: "Mai", valor: 2160 },
  { mes: "Jun", valor: 2380 },
];

export interface Kpi {
  id: string;
  label: string;
  valor: string;
  delta: number; // % vs mês anterior
  icon: string; // lucide icon name
}

export const portalKpis: Kpi[] = [
  { id: "resgates", label: "Resgates no mês", valor: "482", delta: 12.4, icon: "Ticket" },
  { id: "visualizacoes", label: "Visualizações", valor: "9.680", delta: 8.1, icon: "Eye" },
  { id: "conversao", label: "Taxa de conversão", valor: "24,6%", delta: 3.2, icon: "TrendingUp" },
  { id: "avaliacao", label: "Avaliação média", valor: "4,8", delta: 0.3, icon: "Star" },
];

export const adminKpis: Kpi[] = [
  { id: "receita", label: "Receita (MRR)", valor: "R$ 81,9k", delta: 13.1, icon: "DollarSign" },
  { id: "assinantes", label: "Assinantes ativos", valor: "2.950", delta: 9.7, icon: "Users" },
  { id: "estabelecimentos", label: "Estabelecimentos", valor: "186", delta: 5.4, icon: "Store" },
  { id: "resgates", label: "Resgates no mês", valor: "2.380", delta: 10.2, icon: "Ticket" },
];

// ============================================================
// PLATAFORMA — números para a landing
// ============================================================
export const landingStats = [
  { valor: "+186", label: "estabelecimentos parceiros" },
  { valor: "+12 mil", label: "cupons resgatados" },
  { valor: "R$ 1,3 mi", label: "economizados pelos usuários" },
  { valor: "4,8★", label: "avaliação média na loja" },
];
