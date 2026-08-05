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

/**
 * Fase 9/Z2 — a resposta única do cadastro.
 *
 * "E-mail já cadastrado" e qualquer outra falha do `signUp` devolvem ESTA
 * frase, byte a byte. Antes o texto dizia "Este e-mail já está cadastrado", o
 * que confirmava a existência da conta a qualquer visitante.
 *
 * Repare no que ela faz e no que evita: aponta o login para quem esqueceu que
 * tem conta — a UX legítima que não podia quebrar — sem afirmar que **este**
 * e-mail existe. "Se você já tem uma conta" é condicional; "este e-mail já
 * está cadastrado" era uma afirmação sobre um terceiro.
 *
 * Mora aqui, e não em `actions/auth.ts`, porque arquivo `"use server"` só
 * exporta função `async` — exportar uma string de lá atravessa o build calado
 * e derruba a rota na primeira requisição (armadilha paga na Fase 8).
 */
export const MENSAGEM_CADASTRO_GENERICA =
  "Não foi possível concluir o cadastro com esses dados. Se você já tem uma conta, entre por aqui.";
