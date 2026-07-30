/**
 * Abre/restaura a JANELA DE CONSUMO dos cupons do seed — helper das suítes.
 *
 * POR QUE ISTO EXISTE
 * A Fase 5 pôs a janela de consumo no servidor: `ativar_cupom` recusa com
 * motivo 'fora_da_janela' quando o cupom tem dia/horário e o relógio está
 * fora deles. As suítes das fases 1–3 ativam cupons do seed que TÊM janela:
 *
 *   test-rls.ts:169     c01  (Ter–Dom, 18:00–23:00)
 *   test-fase2.ts:84,95 c01
 *   test-fase2.ts:154   c02  (Seg–Sex, 11:00–15:00)
 *   test-fase2.ts:176   c03  (Seg–Sáb, 06:00–22:00)
 *   test-fase3.ts:166   c02  · test-fase3.ts:170  c01
 *
 * As janelas de c01 e c02 são DISJUNTAS (c01 exclui Seg; c02 exclui 18h–23h):
 * não existe instante do relógio em que `npm run verify` ficasse verde. Sem
 * este helper a suíte não é "às vezes flaky" — é impossível.
 *
 * O QUE ELE FAZ
 * Abre a janela (mantendo `descricao` intacta) antes dos testes e devolve um
 * snapshot do jsonb ORIGINAL para restaurar em `finally`. As suítes seguem
 * provando o que sempre quiseram provar — o ciclo do cupom — sem depender da
 * hora em que rodaram. Quem prova a janela é `test-fase5.ts`, com fixtures
 * próprios (`f5-*`) e sem tocar no seed.
 *
 * ATENÇÃO NO HOSPEDADO: `test:rls:hosted` passa a mutar `cupons.horarios`
 * transitoriamente. O `finally` restaura o jsonb original byte a byte; ainda
 * assim, a regra do projeto continua valendo — nenhuma suíte roda contra as
 * contas/dados que o cliente está usando sem decisão explícita.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** jsonb original de cada cupom tocado, para devolver exatamente como estava. */
export type SnapshotJanela = Array<{ id: string; horarios: unknown }>;

/** Cupons do seed que as suítes legadas ativam esperando sucesso. */
export const CUPONS_DAS_SUITES = ["c01", "c02", "c03"] as const;

/**
 * Zera a restrição de dia e abre 00:00–23:59 nos cupons indicados.
 * `descricao` é preservada (é o texto que a UI mostra).
 */
export async function abrirJanela(
  svc: SupabaseClient,
  ids: readonly string[] = CUPONS_DAS_SUITES,
): Promise<SnapshotJanela> {
  const { data, error } = await svc
    .from("cupons")
    .select("id, horarios")
    .in("id", ids as string[]);
  if (error) throw new Error(`abrirJanela (leitura): ${error.message}`);

  const snapshot: SnapshotJanela = (data ?? []).map((r) => ({
    id: r.id as string,
    horarios: r.horarios,
  }));

  for (const linha of snapshot) {
    const original =
      linha.horarios && typeof linha.horarios === "object" && !Array.isArray(linha.horarios)
        ? (linha.horarios as Record<string, unknown>)
        : {};
    const { error: errUp } = await svc
      .from("cupons")
      .update({ horarios: { ...original, dias: [], inicio: "00:00", fim: "23:59" } })
      .eq("id", linha.id);
    if (errUp) throw new Error(`abrirJanela (${linha.id}): ${errUp.message}`);
  }

  return snapshot;
}

/** Devolve o jsonb exatamente como estava antes de `abrirJanela`. */
export async function restaurarJanela(
  svc: SupabaseClient,
  snapshot: SnapshotJanela,
): Promise<void> {
  for (const linha of snapshot) {
    const { error } = await svc
      .from("cupons")
      .update({ horarios: linha.horarios as never })
      .eq("id", linha.id);
    if (error) {
      // não derruba a suíte no finally, mas precisa ficar visível
      console.error(`  !! restaurarJanela (${linha.id}): ${error.message}`);
    }
  }
}
