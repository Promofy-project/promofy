"use server";

import { createClient } from "@/lib/supabase/server";

// Pontes finas para as RPCs da Fase 4 — a escrita direta em `favoritos`
// e `novidades_visto` é revogada; a RPC (security definer, posse por
// auth.uid()) é o único caminho. Nenhuma action lança.
type FavResult = { ok: boolean };

function ok(data: unknown): boolean {
  return Boolean((data as { ok?: boolean } | null)?.ok);
}

/** Favorita um estabelecimento (idempotente; exige estabelecimento ativo). */
export async function favoritarAction(estabelecimentoId: string): Promise<FavResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("favoritar_estabelecimento", {
      p_est_id: estabelecimentoId,
    });
    return { ok: !error && ok(data) };
  } catch {
    return { ok: false };
  }
}

/** Remove um estabelecimento dos favoritos (idempotente). */
export async function desfavoritarAction(estabelecimentoId: string): Promise<FavResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("desfavoritar_estabelecimento", {
      p_est_id: estabelecimentoId,
    });
    return { ok: !error && ok(data) };
  } catch {
    return { ok: false };
  }
}

/** Marca as novidades de favoritos como vistas (zera o badge do sino). */
export async function marcarNovidadesVistasAction(): Promise<FavResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("marcar_novidades_vistas");
    return { ok: !error && ok(data) };
  } catch {
    return { ok: false };
  }
}
