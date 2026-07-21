import "server-only";

import { createClient } from "@/lib/supabase/server";

function horariosDesc(horarios: unknown): string {
  if (horarios && typeof horarios === "object" && !Array.isArray(horarios)) {
    const d = (horarios as Record<string, unknown>).descricao;
    if (typeof d === "string") return d;
  }
  return "";
}
function regrasArr(regras: unknown): string[] {
  return Array.isArray(regras)
    ? regras.filter((r): r is string => typeof r === "string")
    : [];
}

export interface AdminCupom {
  id: string;
  titulo: string;
  beneficio: string;
  economia: number;
  status: string;
  categoriaId: string;
  estabelecimentoNome: string;
  estabelecimentoStatus: string;
  validadeInicio: string | null;
  validadeFim: string;
  ocultarAteInicio: boolean;
  limiteTotal: number | null;
  limitePorUsuario: number;
  prazoAtivacaoHoras: number;
  regras: string[];
  horarios: string;
  criadoEm: string;
}

/** Todos os cupons (para moderação). Só admin lê tudo (policy "admin le todos"). */
export async function buscarCuponsAdmin(): Promise<AdminCupom[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cupons")
    .select("*, estabelecimentos(nome, status)")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(`Falha ao buscar cupons (admin): ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    beneficio: row.beneficio,
    economia: Number(row.economia),
    status: row.status,
    categoriaId: row.categoria_id,
    estabelecimentoNome: row.estabelecimentos?.nome ?? "—",
    estabelecimentoStatus: row.estabelecimentos?.status ?? "—",
    validadeInicio: row.validade_inicio,
    validadeFim: row.validade_fim,
    ocultarAteInicio: row.ocultar_ate_inicio,
    limiteTotal: row.limite_total,
    limitePorUsuario: row.limite_por_usuario,
    prazoAtivacaoHoras: row.prazo_ativacao_horas,
    regras: regrasArr(row.regras),
    horarios: horariosDesc(row.horarios),
    criadoEm: row.criado_em,
  }));
}

export interface AdminEstabelecimento {
  id: string;
  nome: string;
  cidade: string;
  status: string;
  categoriaId: string;
  cuponsAtivos: number;
  cuponsTotal: number;
}

/** Todos os estabelecimentos + contagem de cupons (moderação). */
export async function buscarEstabelecimentosAdmin(): Promise<AdminEstabelecimento[]> {
  const supabase = createClient();
  const { data: ests, error } = await supabase
    .from("estabelecimentos")
    .select("id, nome, cidade, status, categoria_id")
    .order("nome", { ascending: true });
  if (error)
    throw new Error(`Falha ao buscar estabelecimentos (admin): ${error.message}`);

  const { data: cupons } = await supabase
    .from("cupons")
    .select("estabelecimento_id, status");
  const ativos = new Map<string, number>();
  const total = new Map<string, number>();
  (cupons ?? []).forEach((c) => {
    total.set(c.estabelecimento_id, (total.get(c.estabelecimento_id) ?? 0) + 1);
    if (c.status === "ativo") {
      ativos.set(c.estabelecimento_id, (ativos.get(c.estabelecimento_id) ?? 0) + 1);
    }
  });

  return (ests ?? []).map((e) => ({
    id: e.id,
    nome: e.nome,
    cidade: e.cidade,
    status: e.status,
    categoriaId: e.categoria_id,
    cuponsAtivos: ativos.get(e.id) ?? 0,
    cuponsTotal: total.get(e.id) ?? 0,
  }));
}
