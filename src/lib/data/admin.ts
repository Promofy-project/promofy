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

export interface AdminUsuario {
  id: string;
  nome: string;
  cidade: string | null;
  criadoEm: string;
  pontos: number;
  economiaTotal: number;
  cuponsUsados: string[]; // títulos dos cupons validados
  estabelecimentos: string[]; // nomes distintos frequentados
}

/**
 * Detalhe dos consumidores para o admin (D1): cadastro, pontos (ledger),
 * economia total (soma da economia dos cupons validados), cupons usados e
 * estabelecimentos frequentados. Tudo sob as policies "admin le todos".
 */
export async function buscarUsuariosAdmin(): Promise<AdminUsuario[]> {
  const supabase = createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, nome, cidade, criado_em")
    .eq("role", "consumidor")
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`Falha ao buscar usuários (admin): ${error.message}`);

  // pontos: SUM do ledger por usuário
  const { data: pontos } = await supabase
    .from("pontos_transacoes")
    .select("usuario_id, pontos");
  const pontosPor = new Map<string, number>();
  (pontos ?? []).forEach((t) =>
    pontosPor.set(t.usuario_id, (pontosPor.get(t.usuario_id) ?? 0) + t.pontos),
  );

  // validações: economia + cupons + estabelecimentos por usuário
  const { data: usos } = await supabase
    .from("cupons_usuario")
    .select("usuario_id, cupons(titulo, economia, estabelecimentos(nome))")
    .eq("status", "validado");
  const economiaPor = new Map<string, number>();
  const cuponsPor = new Map<string, string[]>();
  const estabPor = new Map<string, Set<string>>();
  (usos ?? []).forEach((u) => {
    const cupom = u.cupons;
    if (!cupom) return;
    economiaPor.set(
      u.usuario_id,
      (economiaPor.get(u.usuario_id) ?? 0) + Number(cupom.economia),
    );
    const arr = cuponsPor.get(u.usuario_id) ?? [];
    arr.push(cupom.titulo);
    cuponsPor.set(u.usuario_id, arr);
    const nome = cupom.estabelecimentos?.nome;
    if (nome) {
      const set = estabPor.get(u.usuario_id) ?? new Set<string>();
      set.add(nome);
      estabPor.set(u.usuario_id, set);
    }
  });

  return (profiles ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    cidade: p.cidade,
    criadoEm: p.criado_em,
    pontos: pontosPor.get(p.id) ?? 0,
    economiaTotal: economiaPor.get(p.id) ?? 0,
    cuponsUsados: cuponsPor.get(p.id) ?? [],
    estabelecimentos: Array.from(estabPor.get(p.id) ?? []),
  }));
}
