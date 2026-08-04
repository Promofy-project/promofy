import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      /**
       * O default do Next 14 é 1 MB, e o arquivo aceito vai a 2 MiB — sem isto
       * TODO upload acima de 1 MB falha com erro opaco (Fase 7/C4).
       *
       * 3 MB e não 2: o corpo carrega o multipart além dos bytes da imagem.
       * A folga é pequena de propósito — este limite vale para TODAS as Server
       * Actions, então cada MB a mais é superfície de DoS. A barreira real do
       * tamanho é `validarBytesImagem` (checa antes de ler o conteúdo) e o
       * `file_size_limit` de 2 MiB do bucket.
       */
      bodySizeLimit: "3mb",
    },
  },
};

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
