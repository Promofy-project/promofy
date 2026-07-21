import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
function hojeBrt(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Data (YYYY-MM-DD) de um timestamp ISO no fuso America/Sao_Paulo. */
function dataBrt(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export interface ResumoEstab {
  estabelecimento: { id: string; nome: string; status: string } | null;
  cuponsAtivos: number;
  resgatesHoje: number;
}

/**
 * Resumo operacional da home do /e: cupons ativos e resgates de HOJE
 * (fuso America/Sao_Paulo — coerente com hoje_brt() do banco; contar por
 * dia UTC mostraria número errado à noite no servidor da Vercel).
 * Sob a RLS do lojista (lê o próprio estabelecimento e os resgates dos
 * próprios cupons). Degrada para zeros se não houver estabelecimento.
 */
export async function buscarResumoEstab(): Promise<ResumoEstab> {
  const supabase = createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { estabelecimento: null, cuponsAtivos: 0, resgatesHoje: 0 };

  const { data: est } = await supabase
    .from("estabelecimentos")
    .select("id, nome, status")
    .eq("owner_id", uid)
    .maybeSingle();
  if (!est) return { estabelecimento: null, cuponsAtivos: 0, resgatesHoje: 0 };

  const { data: cupons } = await supabase
    .from("cupons")
    .select("id, status")
    .eq("estabelecimento_id", est.id);

  const ids = (cupons ?? []).map((c) => c.id);
  const cuponsAtivos = (cupons ?? []).filter((c) => c.status === "ativo").length;

  let resgatesHoje = 0;
  if (ids.length > 0) {
    const { data: usos } = await supabase
      .from("cupons_usuario")
      .select("validado_em")
      .in("cupom_id", ids)
      .eq("status", "validado")
      .not("validado_em", "is", null);
    const hoje = hojeBrt();
    resgatesHoje = (usos ?? []).filter(
      (u) => u.validado_em && dataBrt(u.validado_em) === hoje,
    ).length;
  }

  return {
    estabelecimento: { id: est.id, nome: est.nome, status: est.status },
    cuponsAtivos,
    resgatesHoje,
  };
}
