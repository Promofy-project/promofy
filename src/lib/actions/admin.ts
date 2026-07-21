"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Nenhuma action lança: erros viram { ok:false, motivo } para a UI tratar.
// A checagem de papel (admin) vive DENTRO da RPC security definer
// (private.is_admin) — aqui é só a ponte. Cliente sem papel recebe
// 'sem_permissao' do servidor.
type ModResult = { ok: true } | { ok: false; motivo: string };

function parse(data: unknown): ModResult {
  const r = data as { ok?: boolean; motivo?: string } | null;
  return r?.ok ? { ok: true } : { ok: false, motivo: r?.motivo ?? "erro" };
}

/** Admin aprova um cupom pendente → ativo (passa a aparecer no /m). */
export async function aprovarCupomAction(cupomId: string): Promise<ModResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("aprovar_cupom", {
      p_cupom_id: cupomId,
    });
    if (error) return { ok: false, motivo: "erro" };
    const r = parse(data);
    if (r.ok) revalidatePath("/admin/cupons");
    return r;
  } catch {
    return { ok: false, motivo: "erro" };
  }
}

/** Admin rejeita um cupom pendente → rejeitado (não aparece no /m). */
export async function rejeitarCupomAction(cupomId: string): Promise<ModResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("rejeitar_cupom", {
      p_cupom_id: cupomId,
    });
    if (error) return { ok: false, motivo: "erro" };
    const r = parse(data);
    if (r.ok) revalidatePath("/admin/cupons");
    return r;
  } catch {
    return { ok: false, motivo: "erro" };
  }
}

/** Admin aprova/suspende/reativa um estabelecimento (ativo | suspenso). */
export async function moderarEstabelecimentoAction(
  estId: string,
  status: "ativo" | "suspenso",
): Promise<ModResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "definir_status_estabelecimento",
      { p_est_id: estId, p_status: status },
    );
    if (error) return { ok: false, motivo: "erro" };
    const r = parse(data);
    if (r.ok) {
      revalidatePath("/admin/estabelecimentos");
      revalidatePath("/admin/cupons");
    }
    return r;
  } catch {
    return { ok: false, motivo: "erro" };
  }
}
