"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { TODOS_DOCUMENTOS_LEGAIS, documentoAceitavel } from "@/lib/documentos-legais";

type Resultado = { ok: true } | { ok: false; erro: string };

async function uidSessao(): Promise<string | null> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  return (claims?.claims?.sub as string | undefined) ?? null;
}

/**
 * Registra o aceite do documento ATUAL (versão resolvida aqui, no
 * servidor, a partir de `documentos-legais.ts` — nunca do cliente, para
 * que não seja possível gravar aceite de uma versão que não é a vigente).
 */
export async function registrarAceiteAction(documento: string): Promise<Resultado> {
  const doc = TODOS_DOCUMENTOS_LEGAIS.find((d) => d.documento === documento);
  if (!doc) return { ok: false, erro: "Documento desconhecido." };
  // P0-1 (WP 01H): mesmo que algo chame esta action fora do gate (que já
  // não oferece checkbox para draft), a barreira real fica aqui — nenhum
  // aceite novo é gravado para documento que ainda não está publicado.
  if (!documentoAceitavel(doc)) {
    return { ok: false, erro: "Este documento ainda não está publicado." };
  }

  const uid = await uidSessao();
  if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  const supabase = createClient();
  const { error } = await supabase
    .from("aceites_documento")
    .insert({ usuario_id: uid, documento: doc.documento, versao: doc.versao });
  // `unique (usuario_id, documento, versao)` — reaceite da mesma versão é
  // idempotente, não um erro para o usuário.
  if (error && error.code !== "23505") {
    return { ok: false, erro: "Não foi possível registrar o aceite." };
  }

  revalidatePath("/m");
  revalidatePath("/portal");
  revalidatePath("/m/perfil/privacidade");
  return { ok: true };
}

export async function solicitarEncerramentoContaAction(): Promise<Resultado> {
  const uid = await uidSessao();
  if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("solicitar_encerramento_conta");
  if (error) return { ok: false, erro: "Não foi possível solicitar o encerramento." };
  const r = data as { ok: boolean; motivo?: string };
  if (!r.ok) {
    const msg =
      r.motivo === "papel_nao_suportado"
        ? "Encerramento de conta de parceiro ainda não é self-service — fale com o time Promofy."
        : "Não foi possível solicitar o encerramento.";
    return { ok: false, erro: msg };
  }
  revalidatePath("/m");
  revalidatePath("/m/perfil/privacidade");
  return { ok: true };
}

export async function cancelarEncerramentoContaAction(): Promise<Resultado> {
  const uid = await uidSessao();
  if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancelar_encerramento_conta");
  if (error) return { ok: false, erro: "Não foi possível cancelar." };
  const r = data as { ok: boolean };
  if (!r.ok) return { ok: false, erro: "Não foi possível cancelar." };
  revalidatePath("/m");
  revalidatePath("/m/perfil/privacidade");
  return { ok: true };
}
