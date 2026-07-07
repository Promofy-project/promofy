// Sistema visual compartilhado das landings (refino "premium").
// Tokens de classe reutilizados por para-voce, para-empresas e componentes de seção.

/** Card padrão: cantos suaves, borda leve e sombra em 2 camadas + leve elevação no hover. */
export const LP_CARD =
  "rounded-2xl border border-border/60 bg-surface p-6 shadow-[0_1px_2px_rgba(20,20,60,0.04),0_10px_30px_-12px_rgba(20,20,60,0.15)] transition hover:-translate-y-0.5 hover:shadow-lg";

/** Recipiente de ícone do card (quadrado arredondado). */
export const LP_ICON =
  "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary";

/** Marcador numerado (passos). */
export const LP_STEP =
  "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground";

export const LP_CARD_TITLE = "text-lg font-bold text-foreground";
export const LP_CARD_TEXT = "text-[15px] leading-relaxed text-foreground/70";

/** Espaçamento vertical e container padrão das seções. */
export const LP_SECTION = "py-16 sm:py-24";
export const LP_CONTAINER = "mx-auto max-w-6xl px-6";

/** Botões (aplicados via className sobre <Button size="lg">). */
export const LP_BTN_PRIMARY = "rounded-xl text-[15px]";
export const LP_BTN_SECONDARY =
  "rounded-xl border-primary/30 text-primary text-[15px] hover:bg-primary/5";
