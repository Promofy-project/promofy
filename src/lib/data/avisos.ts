import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Mural de recados (Fase 8/M1).
 *
 * Um fetcher só, usado pelo `/e` (modo totem) e pelo portal (gestão) — o que
 * muda entre os dois é o layout, não a consulta. A RLS decide o que cada um
 * enxerga; nenhuma destas funções filtra por estabelecimento à mão, e isso é
 * deliberado: filtro em duas camadas é filtro que diverge.
 */

export interface AvisoDoLojista {
  id: string;
  titulo: string;
  corpo: string;
  publicadoEm: string;
  lido: boolean;
}

/** Avisos visíveis ao lojista logado, mais recentes primeiro. */
export async function buscarAvisosDoLojista(): Promise<AvisoDoLojista[]> {
  const supabase = createClient();
  const [{ data: avisos }, { data: lidos }] = await Promise.all([
    supabase.from("avisos").select("id, titulo, corpo, publicado_em").order("publicado_em", { ascending: false }),
    supabase.from("avisos_lidos").select("aviso_id"),
  ]);
  const jaLidos = new Set((lidos ?? []).map((l) => l.aviso_id));
  return (avisos ?? []).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    corpo: a.corpo,
    publicadoEm: a.publicado_em,
    lido: jaLidos.has(a.id),
  }));
}

/**
 * Contagem de não-lidos para o badge.
 *
 * Vem da RPC e não de `.length` sobre o fetcher acima porque o badge é
 * consultado em toda navegação — trazer o corpo de todos os avisos para
 * contar seria caro e sem propósito.
 */
export async function contarAvisosNaoLidos(): Promise<number> {
  try {
    const supabase = createClient();
    const { data } = await supabase.rpc("avisos_nao_lidos");
    return typeof data === "number" ? data : 0;
  } catch {
    // Badge é informação de apoio: se a consulta falhar, some — nunca derruba
    // a navegação inteira do /e.
    return 0;
  }
}

export interface AvisoDoAdmin {
  id: string;
  titulo: string;
  corpo: string;
  publicadoEm: string;
  paraTodos: boolean;
  destinatarios: string[];
  leituras: number;
}

/** Todos os avisos + quem leu (admin). */
export async function buscarAvisosAdmin(): Promise<AvisoDoAdmin[]> {
  const supabase = createClient();
  const [{ data: avisos }, { data: dest }, { data: lidos }] = await Promise.all([
    supabase.from("avisos").select("id, titulo, corpo, publicado_em, para_todos").order("publicado_em", { ascending: false }),
    supabase.from("avisos_destinatarios").select("aviso_id, estabelecimento_id"),
    supabase.from("avisos_lidos").select("aviso_id"),
  ]);

  const porAviso = new Map<string, string[]>();
  for (const d of dest ?? []) {
    porAviso.set(d.aviso_id, [...(porAviso.get(d.aviso_id) ?? []), d.estabelecimento_id]);
  }
  const contagem = new Map<string, number>();
  for (const l of lidos ?? []) contagem.set(l.aviso_id, (contagem.get(l.aviso_id) ?? 0) + 1);

  return (avisos ?? []).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    corpo: a.corpo,
    publicadoEm: a.publicado_em,
    paraTodos: a.para_todos,
    destinatarios: porAviso.get(a.id) ?? [],
    leituras: contagem.get(a.id) ?? 0,
  }));
}
