"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  preferenciasDeRespostas,
  type PreferenciasCanonicas,
} from "@/lib/preferencias";
import {
  FINALIDADE_PERSONALIZACAO,
  VERSAO_CONSENTIMENTO_PERSONALIZACAO,
} from "@/lib/consentimento";

type Resultado = { ok: true } | { ok: false; erro: string };

async function uidSessao(): Promise<string | null> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  return (claims?.claims?.sub as string | undefined) ?? null;
}

function patchPreferencias(p: PreferenciasCanonicas) {
  return {
    objetivos: p.objetivos,
    segmentos: p.segmentos,
    categorias: p.categorias,
    locais: p.locais,
    estilo_consumo: p.estiloConsumo,
    dias: p.dias,
    beneficio_preferido: p.beneficioPreferido,
    gamificacao: p.gamificacao,
    atualizado_em: new Date().toISOString(),
  };
}

export async function salvarPreferenciasAction(
  prefs: PreferenciasCanonicas,
): Promise<Resultado> {
  try {
    const uid = await uidSessao();
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };
    const supabase = createClient();
    const { error } = await supabase.from("preferencias_usuario").upsert(
      { usuario_id: uid, ...patchPreferencias(prefs) },
      { onConflict: "usuario_id" },
    );
    if (error) return { ok: false, erro: "Não foi possível salvar." };
    revalidatePath("/m/perfil/preferencias");
    revalidatePath("/m");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar." };
  }
}

export async function salvarOnboardingAction(respostas: string[][]): Promise<Resultado> {
  return salvarPreferenciasAction(preferenciasDeRespostas(respostas));
}

export async function definirConsentimentoPersonalizacaoAction(
  conceder: boolean,
): Promise<Resultado> {
  try {
    const uid = await uidSessao();
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };
    const supabase = createClient();
    const agora = new Date().toISOString();
    const { error } = await supabase.from("consentimentos_usuario").upsert(
      {
        usuario_id: uid,
        finalidade: FINALIDADE_PERSONALIZACAO,
        versao: VERSAO_CONSENTIMENTO_PERSONALIZACAO,
        concedido_em: conceder ? agora : null,
        revogado_em: conceder ? null : agora,
      },
      { onConflict: "usuario_id,finalidade" },
    );
    if (error) return { ok: false, erro: "Não foi possível salvar o consentimento." };
    revalidatePath("/m/perfil/preferencias");
    revalidatePath("/m");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar o consentimento." };
  }
}
