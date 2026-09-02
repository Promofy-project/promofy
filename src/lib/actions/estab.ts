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
  bairro?: string;
  latitude?: number | null;
  longitude?: number | null;
  logo?: string;
}): Promise<SalvarPerfilResult> {
  try {
    const nome = input.nome?.trim() ?? "";
    const cidade = input.cidade?.trim() ?? "";
    const bairro = input.bairro?.trim() ?? "";
    if (!nome) return { ok: false, erro: "Informe o nome do estabelecimento." };

    if (input.logo !== undefined && input.logo !== "" && !PATH_IMAGEM_RE.test(input.logo)) {
      return { ok: false, erro: "Caminho de logo inválido." };
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (input.latitude != null && input.longitude != null) {
      const lat = Number(input.latitude);
      const lng = Number(input.longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { ok: false, erro: "Latitude inválida." };
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { ok: false, erro: "Longitude inválida." };
      }
      latitude = lat;
      longitude = lng;
    } else if (input.latitude != null || input.longitude != null) {
      return { ok: false, erro: "Informe latitude e longitude juntas, ou deixe as duas em branco." };
    }

    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

    const patch: {
      nome: string;
      cidade: string;
      bairro: string;
      latitude: number | null;
      longitude: number | null;
      logo?: string;
    } = { nome, cidade, bairro, latitude, longitude };
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
