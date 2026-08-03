/**
 * Opções compartilhadas pelos três runtimes do Sentry (Fase 7/P5).
 *
 * Ficam num módulo só para que cliente, servidor e edge não divirjam — é
 * exatamente assim que uma configuração de privacidade some: alguém acerta o
 * scrubbing em dois dos três arquivos.
 */
import { limparEvento } from "./sentry-scrub";

/** Sem DSN o SDK fica inerte — dev local e CI não precisam de conta no Sentry. */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export const opcoesSentry = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),

  /**
   * `VERCEL_ENV` é "production" | "preview" | "development" e é o que separa
   * um erro do cliente de um erro do nosso smoke de branch. Sem ele, todo
   * evento de preview polui o painel de produção.
   */
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",

  /** Erros, não telemetria. "Sem logs verbosos" é requisito da fase. */
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  /**
   * Impede o SDK de anexar IP, cookies e headers de requisição por conta
   * própria. O `beforeSend` é a segunda barreira, não a primeira.
   */
  sendDefaultPii: false,

  beforeSend: limparEvento,
  beforeSendTransaction: limparEvento,
  beforeBreadcrumb: limparEvento,
};
