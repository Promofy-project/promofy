import "server-only";

import type { CategoriaId, Cupom, CupomStatus, MetricasCupom } from "@/lib/types";
import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type CupomRow = Database["public"]["Tables"]["cupons"]["Row"];

/** jsonb regras → string[] (defensivo: qualquer coisa fora do formato vira []). */
function regrasDeJson(regras: CupomRow["regras"]): string[] {
  return Array.isArray(regras)
    ? regras.filter((r): r is string => typeof r === "string")
    : [];
}

/** jsonb horarios {descricao} → string exibida (formato atual da UI). */
function horariosDeJson(horarios: CupomRow["horarios"]): string {
  if (horarios && typeof horarios === "object" && !Array.isArray(horarios)) {
    const d = (horarios as Record<string, unknown>).descricao;
    if (typeof d === "string") return d;
  }
  return "";
}

/** jsonb horarios {dias[]} → labels válidos (Fase 4); fora do formato = sem restrição. */
function diasDeJson(horarios: CupomRow["horarios"]): string[] | undefined {
  if (horarios && typeof horarios === "object" && !Array.isArray(horarios)) {
    const d = (horarios as Record<string, unknown>).dias;
    if (Array.isArray(d)) {
      const dias = d.filter((x): x is string => typeof x === "string");
      return dias.length > 0 ? dias : undefined;
    }
  }
  return undefined;
}

/**
 * Linha do banco → tipo `Cupom` do protótipo. Os componentes de UI
 * (CouponCard etc.) continuam intocados: consomem o mesmo shape.
 * rating/avaliacoes/distancia_km são colunas-protótipo POR CUPOM
 * (paridade visual com o mock — ver plano D9).
 */
export function linhaParaCupom(row: CupomRow, estabelecimentoNome: string): Cupom {
  return {
    id: row.id,
    titulo: row.titulo,
    estabelecimento: estabelecimentoNome,
    estabelecimentoId: row.estabelecimento_id,
    categoria: row.categoria_id as CategoriaId,
    economia: Number(row.economia),
    precoDe: row.preco_de != null ? Number(row.preco_de) : undefined,
    precoPor: row.preco_por != null ? Number(row.preco_por) : undefined,
    distanciaKm: Number(row.distancia_km ?? 0),
    rating: Number(row.rating ?? 0),
    avaliacoes: row.avaliacoes,
    validade: row.validade_fim,
    status: (row.status === "indisponivel" ? "indisponivel" : "ativo") as CupomStatus,
    imagem: row.imagem,
    beneficio: row.beneficio,
    regras: regrasDeJson(row.regras),
    horarios: horariosDeJson(row.horarios),
    dias: diasDeJson(row.horarios),
    destaque: row.destaque,
  };
}

/**
 * Visibilidade do catálogo do consumidor (mesma regra da home desde a
 * Fase 2): validade vigente e agendamento respeitado. A RLS já garantiu
 * status ativo/indisponivel de estabelecimento ativo. "hoje" em BRT.
 */
function filtrarVisiveis<T extends CupomRow>(rows: T[], hoje: string): T[] {
  return rows
    .filter((row) => row.validade_fim >= hoje) // exibir ≡ ativável (Fase 2)
    .filter(
      (row) =>
        !(row.ocultar_ate_inicio && row.validade_inicio && row.validade_inicio > hoje),
    );
}

/**
 * Cupons da home do consumidor (/m), direto do banco.
 * - RLS já garante: só status ativo/indisponivel de estabelecimento ativo.
 * - `ordem` reproduz a ordenação estável do mock (slice(0,6) atual).
 * - Agendamento: cupom com ocultar_ate_inicio e início futuro fica de fora
 *   (comparação por data-string YYYY-MM-DD — determinística, sem Date local;
 *   fuso de referência do agendamento é decisão da Fase 2).
 */
export async function buscarCuponsHome(limite = 6): Promise<Cupom[]> {
  const supabase = createClient();

  // Fase 4: para o usuário logado, cupons de estabelecimentos favoritados
  // sobem para o topo — por isso a busca é sem janela (um favorito além
  // das primeiras `ordem` nunca subiria). Anônimo segue o caminho antigo.
  const { data: claims } = await supabase.auth.getClaims();
  const logado = Boolean(claims?.claims?.sub);

  let query = supabase
    .from("cupons")
    .select("*, estabelecimentos(nome)")
    .in("status", ["ativo", "indisponivel"])
    .order("ordem", { ascending: true });
  if (!logado) query = query.limit(limite * 2); // folga p/ o filtro de agendamento

  const [{ data, error }, favSet] = await Promise.all([
    query,
    logado
      ? supabase
          .from("favoritos")
          .select("estabelecimento_id")
          .then(({ data: favs }) => new Set((favs ?? []).map((f) => f.estabelecimento_id)))
      : Promise.resolve(new Set<string>()),
  ]);

  if (error) {
    throw new Error(`Falha ao buscar cupons da home: ${error.message}`);
  }

  // "hoje" no fuso de negócio (BRT), coerente com hoje_brt() no banco —
  // um cupom válido "até dia X" não some às 21:00 UTC do dia anterior.
  const visiveis = filtrarVisiveis(data ?? [], hojeBrt());
  // partição estável: favoritados primeiro, `ordem` preservada nos grupos
  const ordenados =
    favSet.size > 0
      ? [
          ...visiveis.filter((r) => favSet.has(r.estabelecimento_id)),
          ...visiveis.filter((r) => !favSet.has(r.estabelecimento_id)),
        ]
      : visiveis;
  return ordenados
    .slice(0, limite)
    .map((row) => linhaParaCupom(row, row.estabelecimentos?.nome ?? ""));
}

/**
 * Um cupom visível por id (fallback do detalhe /m/cupom/[id] para cupons
 * criados depois do mock — ex.: aprovados ao vivo, Fase 4). Mesma
 * visibilidade do catálogo; invisível/expirado → null (a página dá 404).
 */
export async function buscarCupomPorId(id: string): Promise<Cupom | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("cupons")
    .select("*, estabelecimentos(nome)")
    .eq("id", id)
    .in("status", ["ativo", "indisponivel"])
    .maybeSingle();
  if (!data) return null;
  if (filtrarVisiveis([data], hojeBrt()).length === 0) return null;
  return linhaParaCupom(data, data.estabelecimentos?.nome ?? "");
}

/**
 * Cupons visíveis dos estabelecimentos favoritados do usuário logado
 * (página /m/favoritos, Fase 4). Anônimo → lista vazia (a página mostra
 * o convite a logar).
 */
export async function buscarCuponsFavoritos(): Promise<Cupom[]> {
  const supabase = createClient();

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return [];

  const { data: favs } = await supabase.from("favoritos").select("estabelecimento_id");
  const ids = (favs ?? []).map((f) => f.estabelecimento_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("cupons")
    .select("*, estabelecimentos(nome)")
    .in("estabelecimento_id", ids)
    .in("status", ["ativo", "indisponivel"])
    .order("ordem", { ascending: true });
  if (error) {
    throw new Error(`Falha ao buscar cupons dos favoritos: ${error.message}`);
  }

  return filtrarVisiveis(data ?? [], hojeBrt()).map((row) =>
    linhaParaCupom(row, row.estabelecimentos?.nome ?? ""),
  );
}

/**
 * Catálogo completo para a busca do /m (Fase 4) — mesma visibilidade da
 * home, sem limite (max_rows do PostgREST = 1000 cobre o catálogo).
 */
export async function buscarCuponsBusca(): Promise<Cupom[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cupons")
    .select("*, estabelecimentos(nome)")
    .in("status", ["ativo", "indisponivel"])
    .order("ordem", { ascending: true });

  if (error) {
    throw new Error(`Falha ao buscar cupons da busca: ${error.message}`);
  }

  return filtrarVisiveis(data ?? [], hojeBrt()).map((row) =>
    linhaParaCupom(row, row.estabelecimentos?.nome ?? ""),
  );
}

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
function hojeBrt(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Lista de cupons do portal do lojista logado, com métricas derivadas
 * de cupom_eventos (view cupom_metricas, security_invoker).
 *
 * statusPortal deriva SÓ da coluna status (decisão D14 do plano) —
 * derivação por data/limite fica para a Fase 2.
 *
 * Sem sessão ou sem estabelecimento vinculado → estabelecimento null +
 * lista vazia (a página renderiza o estado vazio em vez de quebrar).
 */
export interface PortalCupons {
  estabelecimento: { id: string; nome: string; categoriaId: string } | null;
  itens: ItemCupomPortal[];
}

export async function buscarCuponsPortal(): Promise<PortalCupons> {
  const supabase = createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { estabelecimento: null, itens: [] };

  const { data: estabelecimento } = await supabase
    .from("estabelecimentos")
    .select("id, nome, categoria_id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!estabelecimento) return { estabelecimento: null, itens: [] };
  const estOut = {
    id: estabelecimento.id,
    nome: estabelecimento.nome,
    categoriaId: estabelecimento.categoria_id,
  };

  const { data: cupons, error } = await supabase
    .from("cupons")
    .select("*")
    .eq("estabelecimento_id", estabelecimento.id)
    // novos cupons (criados agora) no topo; seed mantém a ordem estável
    .order("criado_em", { ascending: false })
    .order("ordem", { ascending: true });
  if (error) {
    throw new Error(`Falha ao buscar cupons do portal: ${error.message}`);
  }
  if (!cupons || cupons.length === 0) {
    return { estabelecimento: estOut, itens: [] };
  }

  const { data: metricas } = await supabase
    .from("cupom_metricas")
    .select("*")
    .in(
      "cupom_id",
      cupons.map((c) => c.id),
    );

  const metricasPorCupom = new Map<string, MetricasCupom>(
    (metricas ?? []).map((m) => [
      m.cupom_id ?? "",
      {
        visualizacoes: Number(m.visualizacoes ?? 0),
        cliques: Number(m.cliques ?? 0),
        ativacoes: Number(m.ativacoes ?? 0),
        resgates: Number(m.resgates ?? 0),
      },
    ]),
  );

  const itens: ItemCupomPortal[] = cupons.map((row) => ({
    cupom: linhaParaCupom(row, estabelecimento.nome),
    statusPortal:
      row.status === "esgotado"
        ? "esgotado"
        : row.status === "expirado"
          ? "expirado"
          : row.status === "pendente"
            ? "pendente"
            : row.status === "rejeitado"
              ? "rejeitado"
              : "ativo",
    metricas:
      metricasPorCupom.get(row.id) ?? {
        visualizacoes: 0,
        cliques: 0,
        ativacoes: 0,
        resgates: 0,
      },
    limiteTotal: row.limite_total ?? 1000, // fallback: paridade com o mock
    dataInicio: row.validade_inicio ?? undefined,
    ocultarAteInicio: row.ocultar_ate_inicio,
  }));

  return { estabelecimento: estOut, itens };
}
