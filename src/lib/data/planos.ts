import "server-only";

import type { Plano } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

function beneficiosDe(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((x): x is string => typeof x === "string")
    : [];
}

/** Planos do consumidor — fonte `public.planos`, nunca mock. */
export async function buscarPlanosConsumidor(): Promise<Plano[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome, preco, periodo, descricao, beneficios, destaque, bloqueado, badge, legenda, ordem")
    .order("ordem", { ascending: true });
  if (error) {
    throw new Error(`Falha ao buscar planos: ${error.message}`);
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    preco: Number(p.preco),
    periodo: p.periodo,
    descricao: p.descricao,
    beneficios: beneficiosDe(p.beneficios),
    destaque: p.destaque,
    bloqueado: p.bloqueado,
    badge: p.badge ?? undefined,
    legenda: p.legenda ?? undefined,
  }));
}

/** Preço vigente do Básico no banco — regra comercial não hardcodar 9,90. */
export async function precoPlanoBasico(): Promise<number | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("planos")
    .select("preco")
    .eq("id", "basico")
    .maybeSingle();
  if (data?.preco == null) return null;
  const n = Number(data.preco);
  return Number.isFinite(n) ? n : null;
}
