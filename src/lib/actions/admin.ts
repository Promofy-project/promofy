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

/**
 * Admin define o conjunto de categorias de um estabelecimento (Fase 4).
 * Escrita direta na junção sob a RLS de admin (policies "admin insere/
 * remove"); um não-admin cai na policy (0 linhas/42501) e recebe erro.
 * Regras aqui (a RLS não codifica): a principal nunca sai do conjunto e
 * categoria com cupons existentes não pode ser removida.
 */
export async function definirCategoriasEstabelecimentoAction(
  estId: string,
  categorias: string[],
): Promise<ModResult> {
  try {
    const supabase = createClient();

    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("categoria_id")
      .eq("id", estId)
      .maybeSingle();
    if (!est) return { ok: false, motivo: "nao_encontrado" };

    const desejadas = new Set(categorias);
    desejadas.add(est.categoria_id); // principal nunca sai

    const { data: atuais } = await supabase
      .from("estabelecimento_categorias")
      .select("categoria_id")
      .eq("estabelecimento_id", estId);
    const atuaisSet = new Set((atuais ?? []).map((c) => c.categoria_id));

    const adicionar = Array.from(desejadas).filter((c) => !atuaisSet.has(c));
    const remover = Array.from(atuaisSet).filter((c) => !desejadas.has(c));

    // categoria com cupons do estabelecimento não pode ser removida
    // (o trigger de cupons não cobre DELETE na junção — a regra vive aqui)
    if (remover.length > 0) {
      const { data: emUso } = await supabase
        .from("cupons")
        .select("categoria_id")
        .eq("estabelecimento_id", estId)
        .in("categoria_id", remover);
      if ((emUso ?? []).length > 0) return { ok: false, motivo: "categoria_em_uso" };
    }

    if (remover.length > 0) {
      const { error } = await supabase
        .from("estabelecimento_categorias")
        .delete()
        .eq("estabelecimento_id", estId)
        .in("categoria_id", remover);
      if (error) return { ok: false, motivo: "erro" };
    }
    if (adicionar.length > 0) {
      const { error } = await supabase
        .from("estabelecimento_categorias")
        .insert(adicionar.map((c) => ({ estabelecimento_id: estId, categoria_id: c })));
      if (error) return { ok: false, motivo: "erro" };
    }

    revalidatePath("/admin/estabelecimentos");
    return { ok: true };
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
