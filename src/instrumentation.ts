/**
 * Sentry no servidor e no edge (Fase 7/P5).
 *
 * O `withSentryConfig` liga o `experimental.instrumentationHook` sozinho no
 * Next 14 — não é preciso declará-lo no next.config.
 */
import * as Sentry from "@sentry/nextjs";

import { opcoesSentry } from "@/lib/sentry-opcoes";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init(opcoesSentry);
  }
}

/**
 * Captura erros de renderização do servidor (Server Components, Route
 * Handlers). O Next 14.2 ainda não chama este hook — ele existe a partir do
 * 15 —, mas exportá-lo agora é o que faz a captura passar a funcionar sozinha
 * no dia do upgrade, em vez de virar um buraco silencioso.
 */
export const onRequestError = Sentry.captureRequestError;
