"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

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

/**
 * Admin rejeita um cupom pendente → rejeitado (não aparece no /m).
 *
 * Fase 6.5/C5: o MOTIVO passou a ser obrigatório. Ele é o produto do
 * ciclo — sem ele o lojista não sabe o que corrigir e o "editar e
 * reenviar" não fecha. A checagem aqui é só para não gastar ida ao banco;
 * quem recusa de verdade é a RPC (`motivo_obrigatorio`).
 */
export async function rejeitarCupomAction(
  cupomId: string,
  motivo: string,
): Promise<ModResult> {
  try {
    if (!motivo?.trim()) return { ok: false, motivo: "motivo_obrigatorio" };
    const supabase = createClient();
    const { data, error } = await supabase.rpc("rejeitar_cupom", {
      p_cupom_id: cupomId,
      p_motivo: motivo.trim(),
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
 * Admin define o conjunto de FOLHAS de um estabelecimento (Fase 4,
 * cortada para o modelo novo no Marco 2A).
 *
 * Escrita direta em `estabelecimento_categorias_novas` sob a RLS de admin
 * (policies "admin insere/remove", migration 20260831120000); um não-admin
 * cai na policy (0 linhas/42501) e recebe erro.
 *
 * As invariantes NÃO vivem só aqui — e desde o Marco 1 são mais fortes do
 * que eram no legado, onde "categoria em uso não sai" existia apenas nesta
 * Action. Hoje o banco recusa por conta própria remover a principal
 * vigente ou uma folha em uso por cupom (`impedir_remover_categoria_do_
 * conjunto_em_uso`) e recusa vincular folha fora de catálogo
 * (`checar_categoria_nova_ativa_no_vinculo`). O que sobra aqui é a
 * MENSAGEM: o admin merece saber por que não deu, em vez de um erro cru
 * do Postgres.
 */
export async function definirCategoriasEstabelecimentoAction(
  estId: string,
  categorias: string[],
): Promise<ModResult> {
  try {
    const supabase = createClient();

    // Papel checado no servidor ALÉM da RLS (defesa em profundidade —
    // sem isto, um delete barrado pela policy afeta 0 linhas sem erro e
    // devolveria um ok:true enganoso).
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, motivo: "sem_permissao" };
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();
    if (perfil?.role !== "admin") return { ok: false, motivo: "sem_permissao" };

    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("categoria_principal_id")
      .eq("id", estId)
      .maybeSingle();
    if (!est) return { ok: false, motivo: "nao_encontrado" };

    const desejadas = new Set(categorias);
    if (est.categoria_principal_id) desejadas.add(est.categoria_principal_id); // principal nunca sai

    const { data: atuais } = await supabase
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", estId);
    const atuaisSet = new Set((atuais ?? []).map((c) => c.categoria_id));

    const adicionar = Array.from(desejadas).filter((c) => !atuaisSet.has(c));
    const remover = Array.from(atuaisSet).filter((c) => !desejadas.has(c));

    // MARCO 2A: vínculo NOVO só com folha em catálogo. `ativo` governa
    // nova seleção — um vínculo que já existe e cuja folha foi desativada
    // depois continua valendo, e por isso a checagem é só sobre
    // `adicionar`, nunca sobre `atuaisSet`.
    if (adicionar.length > 0) {
      const { data: atribuiveis } = await supabase
        .from("catalogo_folhas")
        .select("categoria_id")
        .in("categoria_id", adicionar);
      if ((atribuiveis ?? []).length !== adicionar.length) {
        return { ok: false, motivo: "categoria_inativa" };
      }
    }

    // Folha com cupons do estabelecimento não pode ser removida. O trigger
    // do banco também recusa (Marco 1) — aqui a checagem existe para o
    // admin receber "há cupons nessa categoria" em vez de um SQLSTATE.
    if (remover.length > 0) {
      const { data: emUso } = await supabase
        .from("cupons")
        .select("categoria_nova_id")
        .eq("estabelecimento_id", estId)
        .in("categoria_nova_id", remover);
      if ((emUso ?? []).length > 0) return { ok: false, motivo: "categoria_em_uso" };
    }

    if (remover.length > 0) {
      const { error } = await supabase
        .from("estabelecimento_categorias_novas")
        .delete()
        .eq("estabelecimento_id", estId)
        .in("categoria_id", remover);
      if (error) return { ok: false, motivo: "erro" };
    }
    if (adicionar.length > 0) {
      const { error } = await supabase
        .from("estabelecimento_categorias_novas")
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

const ACOES_PONTOS = ["resgate", "nps", "indicacao", "visita"] as const;

/**
 * Admin grava a tabela de pontos (`config_pontos`). A RLS já restringe
 * escrita a `private.is_admin()`; aqui a checagem de papel é defesa em
 * profundidade e a whitelist impede inventar ação nova pelo client.
 */
export async function salvarConfigPontosAction(
  pontos: Record<string, number>,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada." };
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();
    if (perfil?.role !== "admin") return { ok: false, erro: "Sem permissão." };

    for (const acao of ACOES_PONTOS) {
      const n = Math.trunc(Number(pontos[acao]));
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, erro: `Valor inválido em ${acao}.` };
      }
      const { error } = await supabase
        .from("config_pontos")
        .update({ pontos: n })
        .eq("acao", acao);
      if (error) return { ok: false, erro: "Não foi possível salvar a tabela de pontos." };
    }

    revalidatePath("/admin/configuracoes");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar a tabela de pontos." };
  }
}

export async function adminEditarCupomAction(
  cupomId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    if (!cupomId) return { ok: false, erro: "Cupom não informado." };
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_editar_cupom", {
      p_cupom_id: cupomId,
      p_patch: patch as Json,
    });
    if (error) return { ok: false, erro: "Não foi possível salvar." };
    const r = data as { ok?: boolean; motivo?: string } | null;
    if (r?.ok) {
      revalidatePath("/admin/cupons");
      return { ok: true };
    }
    const MSG: Record<string, string> = {
      sem_permissao: "Sua conta não tem permissão de moderação.",
      nao_encontrado: "Cupom não encontrado.",
      campo_proibido: "Este campo não pode ser alterado.",
      titulo_vazio: "Informe o título.",
      validade_vazia: "Informe a validade.",
                    categoria_invalida: "Categoria inválida para este estabelecimento.",
                    tipo_invalido: "Tipo de promoção inválido.",
                    patch_invalido: "Nada para alterar.",
    };
    return { ok: false, erro: MSG[r?.motivo ?? ""] ?? "Não foi possível salvar." };
  } catch {
    return { ok: false, erro: "Não foi possível salvar." };
  }
}
