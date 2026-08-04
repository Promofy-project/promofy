/**
 * Estado dos formulários de autenticação — módulo PURO, de propósito.
 *
 * Isto não pode morar em `src/lib/actions/auth.ts`: um arquivo `"use server"`
 * só exporta funções `async`. Exportar daqui um objeto (`ESTADO_AUTH_INICIAL`)
 * derruba a página com "A 'use server' file can only export async functions,
 * found object".
 *
 * E o detalhe que a armadilha registrada no CLAUDE.md ainda não cobria: um
 * export de VALOR atravessa o `next build` sem um pio e só explode quando a
 * rota é pedida. O `tsc` também não vê. Foi assim que este arquivo nasceu.
 */

export type EstadoAuth = { erro: string | null };

export const ESTADO_AUTH_INICIAL: EstadoAuth = { erro: null };
