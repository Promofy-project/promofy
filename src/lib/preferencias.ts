/**
 * Preferências do consumidor — tokens canônicos, não a frase da opção.
 *
 * O onboarding tem 7 perguntas; cada opção mapeia para um token estável.
 * Segmentos/categorias usam slugs da taxonomia 14×75 quando há equivalente.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

export const PASSOS_ONBOARDING = 7;

export interface PreferenciasCanonicas {
  objetivos: string[];
  segmentos: string[];
  categorias: string[];
  locais: { cidade?: string; bairro?: string }[];
  estiloConsumo: string[];
  dias: string[];
  beneficioPreferido: string[];
  gamificacao: string[];
}

export const PREFERENCIAS_VAZIAS: PreferenciasCanonicas = {
  objetivos: [],
  segmentos: [],
  categorias: [],
  locais: [],
  estiloConsumo: [],
  dias: [],
  beneficioPreferido: [],
  gamificacao: [],
};

type Mapa = Record<string, string>;

const OBJETIVOS: Mapa = {
  "Economizar em restaurantes e cafés": "economizar_alimentacao",
  "Cuidar da saúde e bem-estar": "saude_bem_estar",
  "Aproveitar lazer e entretenimento": "lazer_entretenimento",
  "Encontrar serviços essenciais com desconto": "servicos_essenciais",
  "Comprar produtos com vantagens": "produtos",
};

const LUGARES: Record<string, { segmento?: string; categoria?: string }> = {
  Restaurantes: { segmento: "alimentacao", categoria: "restaurante" },
  "Hamburguerias e Lanchonetes": {
    segmento: "alimentacao",
    categoria: "hamburgueria-lanchonete",
  },
  "Cafeterias e Docerias": { segmento: "alimentacao", categoria: "cafeteria" },
  "Academias e Centros Esportivos": { segmento: "fitness", categoria: "academia" },
  "Salões de Beleza e Barbearias": { segmento: "beleza", categoria: "salao-de-beleza" },
  "Clínicas de Estética ou Spas": { segmento: "beleza", categoria: "clinica-estetica" },
  "Cinemas e Eventos Culturais": { segmento: "entretenimento", categoria: "cinema" },
  "Lojas de Moda": { segmento: "moda" },
  "Petshops e Serviços para Animais": { segmento: "pet" },
  "Serviços automotivos": { segmento: "automotivo" },
};

const ESTILO: Mapa = {
  "Prático e rápido (delivery, take away)": "delivery_retirada",
  "Experiência completa no local (refeições, estética, lazer)": "local",
  "Produtos e serviços para usar em casa": "casa",
};

const DIAS: Mapa = {
  "Segunda a sexta (dias úteis)": "uteis",
  Sábados: "sabado",
  "Domingos e feriados": "domingo_feriado",
};

const BENEFICIO: Mapa = {
  "Descontos diretos (ex: 20% off)": "desconto",
  "Benefícios extra (ex: 2 por 1, brinde grátis)": "leve_mais_pague_menos",
  "Combos promocionais (ex: refeição + sobremesa)": "combo",
};

const GAMIFICACAO: Mapa = {
  "Sim, adoro programas de fidelidade!": "sim",
  "Talvez, só se for vantajoso": "talvez",
  "Não me interesso": "nao",
};

const LOCALIZACAO_SUGESTAO: Mapa = {
  "Sim, sempre!": "sempre",
  "Sim, mas apenas em horários comerciais": "horario_comercial",
  "Não, prefiro ver manualmente": "manual",
};

export const OPCOES_ONBOARDING: { q: string; options: string[] }[] = [
  { q: "Qual o seu principal objetivo usando promofy?", options: Object.keys(OBJETIVOS) },
  {
    q: "Quais tipos de lugares você mais costuma frequentar?",
    options: Object.keys(LUGARES),
  },
  { q: "Qual seu estilo de consumo favorito?", options: Object.keys(ESTILO) },
  {
    q: "Em quais dias da semana você mais costuma consumir ofertas?",
    options: Object.keys(DIAS),
  },
  { q: "Você prefere cupons de:", options: Object.keys(BENEFICIO) },
  {
    q: "Você gostaria de receber sugestões especiais próximas da sua localização?",
    options: Object.keys(LOCALIZACAO_SUGESTAO),
  },
  {
    q: "Você gostaria de acumular pontos ou recompensas ao consumir cupons?",
    options: Object.keys(GAMIFICACAO),
  },
];

export function tokenDeOpcao(passo: number, frase: string): string | null {
  if (passo === 0) return OBJETIVOS[frase] ?? null;
  if (passo === 1) {
    const m = LUGARES[frase];
    return m?.categoria ?? m?.segmento ?? null;
  }
  if (passo === 2) return ESTILO[frase] ?? null;
  if (passo === 3) return DIAS[frase] ?? null;
  if (passo === 4) return BENEFICIO[frase] ?? null;
  if (passo === 5) return LOCALIZACAO_SUGESTAO[frase] ?? null;
  if (passo === 6) return GAMIFICACAO[frase] ?? null;
  return null;
}

/** Respostas das 7 perguntas (frases da UI) → tokens persistidos. */
export function preferenciasDeRespostas(respostas: string[][]): PreferenciasCanonicas {
  const out: PreferenciasCanonicas = {
    objetivos: [],
    segmentos: [],
    categorias: [],
    locais: [],
    estiloConsumo: [],
    dias: [],
    beneficioPreferido: [],
    gamificacao: [],
  };
  const passos = respostas.slice(0, PASSOS_ONBOARDING);
  for (const frase of passos[0] ?? []) {
    const t = OBJETIVOS[frase];
    if (t) out.objetivos.push(t);
  }
  for (const frase of passos[1] ?? []) {
    const m = LUGARES[frase];
    if (!m) continue;
    if (m.segmento && !out.segmentos.includes(m.segmento)) out.segmentos.push(m.segmento);
    if (m.categoria && !out.categorias.includes(m.categoria)) out.categorias.push(m.categoria);
  }
  for (const frase of passos[2] ?? []) {
    const t = ESTILO[frase];
    if (t) out.estiloConsumo.push(t);
  }
  for (const frase of passos[3] ?? []) {
    const t = DIAS[frase];
    if (t) out.dias.push(t);
  }
  for (const frase of passos[4] ?? []) {
    const t = BENEFICIO[frase];
    if (t) out.beneficioPreferido.push(t);
  }
  for (const frase of passos[6] ?? []) {
    const t = GAMIFICACAO[frase];
    if (t) out.gamificacao.push(t);
  }
  return out;
}

export function estiloParaFormas(estilo: string[]): string[] {
  const formas = new Set<string>();
  for (const e of estilo) {
    if (e === "local") formas.add("local");
    if (e === "delivery_retirada") {
      formas.add("delivery");
      formas.add("retirada");
    }
  }
  return Array.from(formas);
}
