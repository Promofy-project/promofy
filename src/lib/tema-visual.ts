// ============================================================
// Promofy — tema visual: token do banco -> cores da apresentação
//
// O banco guarda um TOKEN (`segmentos.tema`, `categorias_novas.tema`),
// NUNCA CSS. O legado guardava `categorias.gradiente` com a string
// 'linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)' inteira — string
// livre que o banco não validava e que amarrava o schema a uma decisão de
// front, e ao CSS da web, num projeto cujo destino é React Native.
//
// Este módulo é a outra ponta dessa decisão: quem traduz token -> cor.
//
// MÓDULO PURO: sem `server-only`, sem DOM, sem `Intl`. Importável pelo
// Next e por um futuro app RN. Por isso o dado canônico é um PAR DE
// CORES (`TEMA_CORES`) e não uma string CSS — o RN não tem
// `linear-gradient`, tem `<LinearGradient colors={[de, para]} />`.
// `gradienteWeb()` é o PONTO DE TROCA declarado: é a única função aqui
// que produz CSS, e é ela que o app nativo substitui.
// ============================================================

export interface ParDeCores {
  /** Cor inicial (0%). */
  de: string;
  /** Cor final (100%). */
  para: string;
}

/**
 * Os 14 tokens do catálogo v1 (`docs/taxonomia/catalogo-v1.json`).
 *
 * PROVENIÊNCIA — os seis primeiros NÃO são escolha nova: são exatamente
 * os gradientes que `public.categorias.gradiente` serve hoje em produção,
 * decompostos em par de cores. Trocá-los mudaria a identidade visual de
 * cupons que o cliente já vê, e o cutover não é lugar para redesign.
 *
 *   laranja  ← alimentacao    verde  ← fitness     rosa   ← beleza
 *   azul     ← eletronicos    indigo ← educacao    ambar  ← pet
 *
 * Os OITO restantes nasceram no Marco 2 como bridge visual. O Marco 3A
 * só refina contraste na UI (ícone branco sobre o gradiente); o TOKEN
 * no banco não muda. Mudar aqui não exige migration — é o motivo de o
 * banco guardar token e não CSS.
 *
 * O domain `tema_visual` valida FORMATO (slug minúsculo), não
 * vocabulário: um token novo entra por dado, e só precisa de uma linha
 * aqui. Um token sem linha aqui cai em `TEMA_FALLBACK` — tolerância
 * defensiva, jamais comportamento normal (ver `scripts/test-m2-cutover.ts`,
 * que falha se algum tema do catálogo real não estiver registrado).
 */
export const TEMA_CORES: Readonly<Record<string, ParDeCores>> = {
  // --- herdados do legado, byte a byte ---
  laranja: { de: "#FF8A3D", para: "#FF5A5F" }, // Alimentação
  verde: { de: "#22C55E", para: "#0EA5A4" }, // Fitness e Saúde
  rosa: { de: "#EC4899", para: "#A855F7" }, // Beleza e Bem Estar
  azul: { de: "#3B82F6", para: "#06B6D4" }, // Eletrônicos
  indigo: { de: "#6366F1", para: "#8B5CF6" }, // Educação
  ambar: { de: "#F59E0B", para: "#F97316" }, // Pet

  // --- bridge visual (Marco 3A: contraste para ícone branco) ---
  grafite: { de: "#3F3F46", para: "#18181B" }, // Automotivo
  roxo: { de: "#9333EA", para: "#6366F1" }, // Entretenimento
  ciano: { de: "#0891B2", para: "#0E7490" }, // Turismo — ciano mais escuro
  violeta: { de: "#7C3AED", para: "#C026D3" }, // Moda
  cinza: { de: "#64748B", para: "#334155" }, // Serviços — aço mais escuro
  vermelho: { de: "#EF4444", para: "#B91C1C" }, // Saúde
  terra: { de: "#B45309", para: "#78350F" }, // Casa e Decoração
  amarelo: { de: "#CA8A04", para: "#A16207" }, // Infantil — ouro, não amarelo-claro
};

/**
 * Cores do fallback de tolerância visual. Espelha o cinza de
 * `CATEGORIA_VISUAL_FALLBACK` e é DIFERENTE do token `cinza`: um cinza
 * igual ao do fallback faria "não sei o que é isto" e "isto é Serviços"
 * desenharem o mesmo card.
 */
export const TEMA_FALLBACK: ParDeCores = { de: "#9CA3AF", para: "#6B7280" };

/** Par de cores do token; desconhecido -> fallback, nunca undefined. */
export function coresDoTema(tema: string): ParDeCores {
  return TEMA_CORES[tema] ?? TEMA_FALLBACK;
}

/**
 * PONTO DE TROCA (só-web): a única função deste módulo que produz CSS.
 * O app React Native substitui esta função por um `<LinearGradient>`
 * alimentado direto por `coresDoTema()` — nada mais deste arquivo muda.
 */
export function gradienteWeb(tema: string): string {
  const { de, para } = coresDoTema(tema);
  return `linear-gradient(135deg, ${de} 0%, ${para} 100%)`;
}
