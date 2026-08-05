import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Indicadores do estabelecimento (Fase 8/M2).
 *
 * Tudo é calculado no SERVIDOR pela RPC `indicadores_estabelecimento`. Este
 * módulo só dá forma tipada ao jsonb — nenhuma conta acontece aqui, porque uma
 * conta duplicada entre servidor e tela é uma conta que diverge.
 */

export interface NotaRecebida {
  nota: number;
  /** Só o primeiro nome — a RPC nunca devolve sobrenome, id, CPF ou e-mail. */
  nome: string;
  cupom: string;
  em: string | null;
}

export interface Indicadores {
  /**
   * `false` = ainda não há NENHUMA resposta de NPS. Distinto de score 0, que
   * significa "tantos detratores quanto promotores". A decisão vem do
   * servidor de propósito: derivá-la na tela foi como o selo "utilizado"
   * errou na Fase 6.
   */
  temDados: boolean;
  respostas: number;
  score: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
  resgatesMes: number;
  ultimas: NotaRecebida[];
}

const VAZIO: Indicadores = {
  temDados: false,
  respostas: 0,
  score: null,
  promotores: 0,
  neutros: 0,
  detratores: 0,
  resgatesMes: 0,
  ultimas: [],
};

export async function buscarIndicadores(): Promise<Indicadores> {
  try {
    const supabase = createClient();
    const { data } = await supabase.rpc("indicadores_estabelecimento");
    const r = data as unknown as Record<string, unknown> | null;
    if (!r || r.ok !== true) return VAZIO;
    return {
      temDados: Boolean(r.tem_dados),
      respostas: Number(r.respostas ?? 0),
      score: r.score === null || r.score === undefined ? null : Number(r.score),
      promotores: Number(r.promotores ?? 0),
      neutros: Number(r.neutros ?? 0),
      detratores: Number(r.detratores ?? 0),
      resgatesMes: Number(r.resgates_mes ?? 0),
      ultimas: Array.isArray(r.ultimas) ? (r.ultimas as NotaRecebida[]) : [],
    };
  } catch {
    return VAZIO;
  }
}
