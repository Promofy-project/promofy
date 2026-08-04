/**
 * Sentry no navegador (Fase 7/P5).
 *
 * `instrumentation-client.ts` e não `sentry.client.config.ts`: o SDK v10 marca
 * o segundo como descontinuado e ele deixa de funcionar sob Turbopack.
 */
import * as Sentry from "@sentry/nextjs";

import { opcoesSentry } from "@/lib/sentry-opcoes";

Sentry.init(opcoesSentry);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
