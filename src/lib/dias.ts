/**
 * Dias da semana — formato canônico do app (o mesmo que o form do portal
 * grava em cupons.horarios.dias desde a Fase 2). Módulo puro, sem
 * "server-only": usado por client components, fetchers e pela suite de
 * testes (tsx importa direto).
 */
export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

// en-US "short" → label canônico. NUNCA parsear o weekday pt-BR do Intl
// ("seg.", "sáb." — minúsculo, com ponto): o mapa ASCII é determinístico
// em qualquer runtime/locale.
const EN_PARA_DIA: Record<string, DiaSemana> = {
  Sun: "Dom",
  Mon: "Seg",
  Tue: "Ter",
  Wed: "Qua",
  Thu: "Qui",
  Fri: "Sex",
  Sat: "Sáb",
};

/**
 * Dia da semana (label canônico) de um instante no fuso America/Sao_Paulo.
 * Calcular SEMPRE no servidor e passar por prop — o "hoje" do client na
 * Vercel (UTC) diverge do Brasil à noite e quebraria a hidratação.
 */
export function diaSemanaBrt(d: Date = new Date()): DiaSemana {
  const en = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
  return EN_PARA_DIA[en] ?? "Seg";
}

/**
 * Um cupom sem restrição de dias (campo ausente ou vazio) vale em
 * qualquer dia; com restrição, só nos dias listados.
 */
export function cupomDisponivelNoDia(
  dias: string[] | undefined,
  dia: string,
): boolean {
  if (!dias || dias.length === 0) return true;
  return dias.includes(dia);
}
