import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  PREFERENCIAS_VAZIAS,
  type PreferenciasCanonicas,
} from "@/lib/preferencias";
import {
  FINALIDADE_PERSONALIZACAO,
  VERSAO_CONSENTIMENTO_PERSONALIZACAO,
  consentimentoAtivo,
  type ConsentimentoRegistro,
} from "@/lib/consentimento";

function arr(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((x): x is string => typeof x === "string")
    : [];
}

function locaisDe(valor: unknown): { cidade?: string; bairro?: string }[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const cidade = typeof o.cidade === "string" ? o.cidade.trim() : "";
    const bairro = typeof o.bairro === "string" ? o.bairro.trim() : "";
    if (!cidade && !bairro) return [];
    return [{ ...(cidade ? { cidade } : {}), ...(bairro ? { bairro } : {}) }];
  });
}

export function linhaParaPreferencias(row: {
  objetivos: unknown;
  segmentos: unknown;
  categorias: unknown;
  locais: unknown;
  estilo_consumo: unknown;
  dias: unknown;
  beneficio_preferido: unknown;
  gamificacao: unknown;
}): PreferenciasCanonicas {
  return {
    objetivos: arr(row.objetivos),
    segmentos: arr(row.segmentos),
    categorias: arr(row.categorias),
    locais: locaisDe(row.locais),
    estiloConsumo: arr(row.estilo_consumo),
    dias: arr(row.dias),
    beneficioPreferido: arr(row.beneficio_preferido),
    gamificacao: arr(row.gamificacao),
  };
}

export async function buscarPreferenciasDaSessao(): Promise<PreferenciasCanonicas> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return PREFERENCIAS_VAZIAS;
  const { data } = await supabase
    .from("preferencias_usuario")
    .select("*")
    .eq("usuario_id", uid)
    .maybeSingle();
  if (!data) return PREFERENCIAS_VAZIAS;
  return linhaParaPreferencias(data);
}

export async function buscarConsentimentoPersonalizacao(): Promise<ConsentimentoRegistro | null> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return null;
  const { data } = await supabase
    .from("consentimentos_usuario")
    .select("finalidade, versao, concedido_em, revogado_em")
    .eq("usuario_id", uid)
    .eq("finalidade", FINALIDADE_PERSONALIZACAO)
    .maybeSingle();
  if (!data) return null;
  return {
    finalidade: data.finalidade,
    versao: data.versao,
    concedidoEm: data.concedido_em,
    revogadoEm: data.revogado_em,
  };
}

export async function sessaoTemPersonalizacao(): Promise<boolean> {
  const row = await buscarConsentimentoPersonalizacao();
  return consentimentoAtivo(row, FINALIDADE_PERSONALIZACAO, VERSAO_CONSENTIMENTO_PERSONALIZACAO);
}
