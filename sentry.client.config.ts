/**
 * Sentry no navegador (Fase 7/P5).
 *
 * NA RAIZ e com ESTE nome, de propósito.
 *
 * A primeira versão usou `src/instrumentation-client.ts`, porque o SDK marca
 * `sentry.client.config.ts` como descontinuado. O arquivo descontinuado é o
 * certo aqui: `instrumentation-client.ts` é convenção do **Next 15.3+**, e este
 * projeto é **Next 14.2.35** — o bundler reconhece o arquivo para injeção de
 * valores (o DSN chegava ao bundle), mas nada o executa. Medido em produção:
 * `window.__SENTRY__` existia e `getClient()` devolvia `undefined`; um erro
 * não-capturado não gerava NENHUM envio ao ingest.
 *
 * Quando o projeto subir para o Next 15, este arquivo volta a ser
 * `src/instrumentation-client.ts` — e o critério de aceite continua o mesmo:
 * cliente ATIVO no navegador, não a presença do arquivo.
 */
import * as Sentry from "@sentry/nextjs";

import { opcoesSentry } from "@/lib/sentry-opcoes";

Sentry.init(opcoesSentry);
