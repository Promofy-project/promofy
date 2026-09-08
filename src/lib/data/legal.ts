import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  type DocumentoLegal,
  DOCUMENTOS_REQUERIDOS_CONSUMIDOR,
  DOCUMENTOS_REQUERIDOS_PARCEIRO,
} from "@/lib/documentos-legais";

export interface AceiteRegistro {
  documento: string;
  versao: string;
  aceitoEm: string;
}

export type StatusConta = "ativo" | "encerramento_solicitado" | "anonimizado";

async function uidSessao(): Promise<string | null> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  return (claims?.claims?.sub as string | undefined) ?? null;
}

/** Aceites do usuário logado — trilha completa, mais recente primeiro. */
export async function buscarAceitesDaSessao(): Promise<AceiteRegistro[]> {
  const uid = await uidSessao();
  if (!uid) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("aceites_documento")
    .select("documento, versao, aceito_em")
    .eq("usuario_id", uid)
    .order("aceito_em", { ascending: false });
  return (data ?? []).map((r) => ({
    documento: r.documento,
    versao: r.versao,
    aceitoEm: r.aceito_em,
  }));
}

/**
 * Documentos requeridos para `papel` que o usuário logado ainda não
 * aceitou na versão atual. Vazio = nada pendente (gate não aparece).
 */
export async function buscarPendenciasLegais(
  papel: "consumidor" | "lojista",
): Promise<DocumentoLegal[]> {
  const requeridos =
    papel === "lojista"
      ? DOCUMENTOS_REQUERIDOS_PARCEIRO
      : DOCUMENTOS_REQUERIDOS_CONSUMIDOR;
  const aceites = await buscarAceitesDaSessao();
  const aceitosSet = new Set(aceites.map((a) => `${a.documento}@${a.versao}`));
  return requeridos.filter((doc) => !aceitosSet.has(`${doc.documento}@${doc.versao}`));
}

export async function buscarStatusContaDaSessao(): Promise<StatusConta | null> {
  const uid = await uidSessao();
  if (!uid) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", uid)
    .maybeSingle();
  return (data?.status as StatusConta | undefined) ?? null;
}
