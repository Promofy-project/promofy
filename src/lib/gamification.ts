import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Star, UserPlus, CalendarCheck } from "lucide-react";

/**
 * Regras de gamificação do consumidor.
 *
 * Fase 2: a FONTE ÚNICA dos valores de pontos é a tabela `config_pontos`
 * no banco (lida pela RPC meu_estado_consumidor e exibida no admin).
 * Os valores abaixo são apenas FALLBACK (offline / fora do provider) e
 * espelham o seed — não são mais a fonte de verdade.
 */
export const PONTOS_PADRAO = {
  resgate: 50,
  nps: 30,
  indicacao: 100,
  visita: 10,
} as const;

export type Nivel = "Bronze" | "Prata" | "Ouro" | "Diamante";

interface NivelInfo {
  nivel: Nivel;
  /** ponto de entrada (pontos acumulados) */
  min: number;
}

/**
 * Faixas de nível. Os limites foram calibrados pelo mock de usuários
 * (src/lib/mock-data.ts): Diamante começa ~8k, Ouro ~5k, Prata ~3k.
 */
export const NIVEIS: NivelInfo[] = [
  { nivel: "Bronze", min: 0 },
  { nivel: "Prata", min: 3000 },
  { nivel: "Ouro", min: 5000 },
  { nivel: "Diamante", min: 8000 },
];

export interface NivelCalculo {
  nivel: Nivel;
  /** próximo nível, ou null se já está no topo */
  proximo: Nivel | null;
  /** pontos que faltam para o próximo nível (0 se topo) */
  faltam: number;
  /** progresso 0–100 dentro da faixa atual (100 se topo) */
  progresso: number;
}

/** Deriva nível, próximo nível e progresso a partir do saldo de pontos. */
export function calcularNivel(pontos: number): NivelCalculo {
  let idx = 0;
  for (let i = 0; i < NIVEIS.length; i++) {
    if (pontos >= NIVEIS[i].min) idx = i;
  }

  const atual = NIVEIS[idx];
  const prox = NIVEIS[idx + 1] ?? null;

  if (!prox) {
    return { nivel: atual.nivel, proximo: null, faltam: 0, progresso: 100 };
  }

  const faixa = prox.min - atual.min;
  const dentro = pontos - atual.min;
  const progresso = faixa > 0 ? Math.round((dentro / faixa) * 100) : 0;

  return {
    nivel: atual.nivel,
    proximo: prox.nivel,
    faltam: Math.max(0, prox.min - pontos),
    progresso: Math.min(100, Math.max(0, progresso)),
  };
}

/** Classes de cor (texto + bg suave) por nível, para o badge. */
export const CORES_NIVEL: Record<Nivel, { badge: string; ring: string }> = {
  Bronze: { badge: "bg-[#fbe8d6] text-[#9a5b1e]", ring: "ring-[#d8915a]" },
  Prata: { badge: "bg-muted text-foreground/70", ring: "ring-muted-foreground/40" },
  Ouro: { badge: "bg-yellow-soft text-[#8a6d0b]", ring: "ring-yellow" },
  Diamante: { badge: "bg-primary/10 text-primary", ring: "ring-primary" },
};

export interface ComoGanhar {
  key: keyof typeof PONTOS_PADRAO;
  icon: LucideIcon;
  label: string;
  pontos: number;
}

const COMO_GANHAR_BASE: Omit<ComoGanhar, "pontos">[] = [
  { key: "resgate", icon: BadgeCheck, label: "Resgatar um cupom" },
  { key: "nps", icon: Star, label: "Responder o NPS" },
  { key: "indicacao", icon: UserPlus, label: "Indicar um amigo" },
  { key: "visita", icon: CalendarCheck, label: "Visita diária ao app" },
];

/**
 * Lista "como ganhar pontos" com os valores da config (banco). Passe o
 * `config` vindo do provider; ausência de chave cai no PONTOS_PADRAO.
 */
export function comoGanhar(config: Record<string, number>): ComoGanhar[] {
  return COMO_GANHAR_BASE.map((g) => ({
    ...g,
    pontos: config[g.key] ?? PONTOS_PADRAO[g.key],
  }));
}
