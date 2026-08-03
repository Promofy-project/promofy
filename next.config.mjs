import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

/**
 * Sentry (Fase 7/P5).
 *
 * `withSentryConfig` liga sozinho o `experimental.instrumentationHook` que o
 * Next 14 exige para `src/instrumentation.ts` — não declare à mão.
 *
 * Sem upload de sourcemap nesta fase: exigiria um SENTRY_AUTH_TOKEN a mais
 * para guardar e rotacionar. O custo é stack trace minificada no painel; a
 * troca é deliberada e está no backlog.
 */
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  disableLogger: true,
  // O SDK só é ativado quando há DSN (ver src/lib/sentry-opcoes.ts), então o
  // build local e o CI seguem funcionando sem nenhuma variável do Sentry.
});
