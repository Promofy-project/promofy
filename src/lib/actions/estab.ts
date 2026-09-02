"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { PATH_IMAGEM_RE } from "@/lib/imagem-cupom";

type SalvarPerfilResult =
  | { ok: true }
  | { ok: false; erro: string };

/**
 * Grava nome, cidade e logo do estabelecimento da SESSÃO.
 *
 * A autoridade é `owner_id`, nunca um id que o client mande. Um lojista
 * que inventasse o id do vizinho no FormData continuaria atualizando a
 * própria linha — e a RLS (`lojista atualiza o proprio`) recusaria a
 * linha alheia mesmo se a action errasse.
 */
export async function salvarPerfilEstabAction(input: {
  nome: string;
  cidade: string;
  logo?: string;
}): Promise<SalvarPerfilResult> {
  try {
    const nome = input.nome?.trim() ?? "";
    const cidade = input.cidade?.trim() ?? "";
    if (!nome) return { ok: false, erro: "Informe o nome do estabelecimento." };

    if (input.logo !== undefined && input.logo !== "" && !PATH_IMAGEM_RE.test(input.logo)) {
      return { ok: false, erro: "Caminho de logo inválido." };
    }

    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

    const patch: { nome: string; cidade: string; logo?: string } = { nome, cidade };
    if (input.logo !== undefined) patch.logo = input.logo;

    const { data, error } = await supabase
      .from("estabelecimentos")
      .update(patch)
      .eq("owner_id", uid)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, erro: "Não foi possível salvar." };
    if (!data) return { ok: false, erro: "Nenhum estabelecimento vinculado à sua conta." };

    revalidatePath("/portal/estabelecimento");
    revalidatePath("/e");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar." };
  }
}
