/**
 * Total economizado do consumidor (Fase 6/C3).
 *
 * Mora fora de `src/lib/actions/cupons.ts` por uma restrição do Next que
 * o `tsc` NÃO pega: num arquivo `"use server"`, TODO export precisa ser
 * uma função async — um helper síncrono exportado ali derruba o
 * `next build` com "Server actions must be async functions". Foi
 * exatamente o que aconteceu, e é a mesma lição da Fase 3: build pega o
 * que o compilador de tipos não pega.
 *
 * Módulo puro (sem "server-only", sem DOM): o app nativo lê o MESMO
 * jsonb da RPC `economia_consumidor` e reaproveita este parser tal e qual.
 */

/**
 * `total` soma a economia MÍNIMA garantida dos cupons validados;
 * `incluiVariavel` diz se algum deles é "a partir de" — é o que
 * autoriza a UI a escrever "mais de R$ X" em vez de um valor exato.
 */
export interface EconomiaDTO {
  total: number;
  incluiVariavel: boolean;
}

export const ECONOMIA_ZERO: EconomiaDTO = { total: 0, incluiVariavel: false };

/**
 * jsonb da RPC → DTO, defensivo contra formato.
 *
 * Defensivo porque `numeric` volta do PostgREST como STRING quando passa
 * do alcance seguro, e porque um retorno inesperado (RPC ausente durante
 * um rollback, por exemplo) não pode virar `NaN` na home — o consumidor
 * veria "R$ NaN" onde deveria ver o quanto economizou.
 */
export function economiaDeJson(valor: unknown): EconomiaDTO {
  if (!valor || typeof valor !== "object") return ECONOMIA_ZERO;
  const j = valor as { total?: unknown; inclui_variavel?: unknown };
  const total = Number(j.total);
  return {
    total: Number.isFinite(total) ? total : 0,
    incluiVariavel: j.inclui_variavel === true,
  };
}
