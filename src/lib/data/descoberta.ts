import "server-only";

import type { Cupom } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { buscarFiltrosTaxonomia, type FiltroTaxonomia } from "@/lib/data/taxonomia";
import {
  buscarCuponsBusca,
  buscarCuponsHome,
  hojeBrt,
  linhaCatalogoParaCupom,
  SELECT_CUPOM_CATALOGO,
} from "@/lib/data/cupons";
import {
  ehEscassez,
  ehNovoDoDia,
  noContextoRegional,
  restantesDe,
  scoreEmAlta,
  type SinalEventos,
} from "@/lib/descoberta";
import {
  passarFiltroConsumidor,
  locaisDoCatalogo,
  type FiltroConsumidor,
} from "@/lib/filtros-consumidor";
import {
  ordenarRecomendacao,
  rotuloTrilho,
  type ItemRecomendacao,
} from "@/lib/recomendacao";
import {
  buscarPreferenciasDaSessao,
  sessaoTemPersonalizacao,
} from "@/lib/data/preferencias";

function dataBrt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function desde7d(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export interface SinaisCatalogo {
  eventos: Map<string, SinalEventos>;
  restantes: Map<string, number | null>;
  resgates: Map<string, number>;
}

type IndicadorVitrine = {
  cupom_id: string;
  limite_total: number | null;
  ocupados: number | null;
  disponiveis: number | null;
  resgates_confirmados: number | null;
};

export function comIndicadores(cupom: Cupom, sinais: SinaisCatalogo): Cupom {
  return {
    ...cupom,
    restantes:
      cupom.limiteTotal == null ? null : (sinais.restantes.get(cupom.id) ?? cupom.limiteTotal),
    resgatesConfirmados: sinais.resgates.get(cupom.id) ?? cupom.resgatesConfirmados ?? 0,
  };
}

export async function buscarSinaisCatalogo(): Promise<SinaisCatalogo> {
  const supabase = createClient();
  const [{ data: evs }, { data: inds }] = await Promise.all([
    supabase.rpc("sinais_descoberta", { p_desde: desde7d() }),
    supabase.rpc("indicadores_vitrine_cupons"),
  ]);

  const eventos = new Map<string, SinalEventos>();
  for (const r of (evs ?? []) as { cupom_id: string; validacoes: number; ativacoes: number }[]) {
    eventos.set(r.cupom_id, {
      validacoes7d: Number(r.validacoes) || 0,
      ativacoes7d: Number(r.ativacoes) || 0,
    });
  }
  const restantes = new Map<string, number | null>();
  const resgates = new Map<string, number>();
  for (const r of (inds ?? []) as IndicadorVitrine[]) {
    if (r.limite_total != null) {
      restantes.set(
        r.cupom_id,
        r.disponiveis != null
          ? Math.max(0, Number(r.disponiveis))
          : restantesDe(r.limite_total, Number(r.ocupados ?? 0)),
      );
    }
    resgates.set(r.cupom_id, Number(r.resgates_confirmados ?? 0));
  }
  return { eventos, restantes, resgates };
}

function aplicarEstoque(cupons: Cupom[], sinais: SinaisCatalogo): Cupom[] {
  return cupons.map((c) => comIndicadores(c, sinais));
}

export async function buscarCatalogoFiltrado(
  idsFolha: string[] | null | undefined,
  filtroConsumidor: FiltroConsumidor,
  filtroJa?: FiltroTaxonomia,
): Promise<Cupom[]> {
  const [cupons, sinais] = await Promise.all([
    buscarCuponsBusca(idsFolha, filtroJa),
    buscarSinaisCatalogo(),
  ]);
  const enriquecidos = aplicarEstoque(cupons, sinais);
  const hoje = hojeBrt();
  let out = enriquecidos.filter((c) => passarFiltroConsumidor(c, filtroConsumidor));
  if (filtroConsumidor.trilho === "novos") {
    out = out.filter((c) => ehNovoDoDia(dataBrt(c.publicadoEm), hoje));
  } else if (filtroConsumidor.trilho === "alta") {
    out = out.filter(
      (c) =>
        scoreEmAlta(sinais.eventos.get(c.id) ?? { validacoes7d: 0, ativacoes7d: 0 }) > 0,
    );
  } else if (filtroConsumidor.trilho === "populares") {
    if (!filtroConsumidor.cidade && !filtroConsumidor.bairro) out = [];
    else {
      out = out.filter((c) =>
        noContextoRegional(c, filtroConsumidor.cidade, filtroConsumidor.bairro),
      );
    }
  } else if (filtroConsumidor.trilho === "unidades") {
    out = out.filter((c) => ehEscassez(c.limiteTotal, c.restantes));
  }
  return out;
}

export async function buscarLocaisPublicos(): Promise<{
  cidades: string[];
  bairrosPorCidade: Record<string, string[]>;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("estabelecimentos")
    .select("cidade, bairro")
    .eq("status", "ativo");
  return locaisDoCatalogo(data ?? []);
}

export interface TrilhosDescoberta {
  novos: Cupom[];
  emAlta: Cupom[];
  popularesRegiao: Cupom[];
  ultimasUnidades: Cupom[];
  sinais: SinaisCatalogo;
}

export async function buscarTrilhosDescoberta(
  cidade?: string,
  bairro?: string,
): Promise<TrilhosDescoberta> {
  const supabase = createClient();
  const [filtro, sinais, query] = await Promise.all([
    buscarFiltrosTaxonomia(),
    buscarSinaisCatalogo(),
    supabase
      .from("cupons")
      .select(SELECT_CUPOM_CATALOGO)
      .in("status", ["ativo", "indisponivel"])
      .order("ordem", { ascending: true }),
  ]);

  const hoje = hojeBrt();
  const visiveis = (query.data ?? [])
    .filter((row) => row.validade_fim >= hoje)
    .filter(
      (row) =>
        !(row.ocultar_ate_inicio && row.validade_inicio && row.validade_inicio > hoje),
    )
    .map((row) =>
      comIndicadores(
        linhaCatalogoParaCupom(
          row,
          filtro,
          sinais.restantes.get(row.id) ?? null,
          sinais.resgates.get(row.id) ?? null,
        ),
        sinais,
      ),
    );

  const novos = visiveis.filter((c) => ehNovoDoDia(dataBrt(c.publicadoEm), hoje));

  const emAlta = [...visiveis]
    .filter((c) => scoreEmAlta(sinais.eventos.get(c.id) ?? { validacoes7d: 0, ativacoes7d: 0 }) > 0)
    .sort((a, b) => {
      const sa = scoreEmAlta(sinais.eventos.get(a.id) ?? { validacoes7d: 0, ativacoes7d: 0 });
      const sb = scoreEmAlta(sinais.eventos.get(b.id) ?? { validacoes7d: 0, ativacoes7d: 0 });
      if (sb !== sa) return sb - sa;
      return a.id < b.id ? -1 : 1;
    });

  const temRegiao = Boolean(cidade || bairro);
  const popularesRegiao = temRegiao
    ? [...visiveis]
        .filter((c) => noContextoRegional(c, cidade, bairro))
        .filter((c) => scoreEmAlta(sinais.eventos.get(c.id) ?? { validacoes7d: 0, ativacoes7d: 0 }) > 0)
        .sort((a, b) => {
          const sa = scoreEmAlta(sinais.eventos.get(a.id) ?? { validacoes7d: 0, ativacoes7d: 0 });
          const sb = scoreEmAlta(sinais.eventos.get(b.id) ?? { validacoes7d: 0, ativacoes7d: 0 });
          if (sb !== sa) return sb - sa;
          return a.id < b.id ? -1 : 1;
        })
    : [];

  const ultimasUnidades = visiveis.filter((c) => ehEscassez(c.limiteTotal, c.restantes));

  return { novos, emAlta, popularesRegiao, ultimasUnidades, sinais };
}

export { dataBrt };

export async function buscarSinaisPessoais(): Promise<{
  favoritos: Set<string>;
  resgatados: Set<string>;
  visitados: Set<string>;
}> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  const vazio = {
    favoritos: new Set<string>(),
    resgatados: new Set<string>(),
    visitados: new Set<string>(),
  };
  if (!uid) return vazio;

  const [{ data: favs }, { data: usos }] = await Promise.all([
    supabase.from("favoritos").select("estabelecimento_id"),
    supabase
      .from("cupons_usuario")
      .select("cupom_id, cupons(estabelecimento_id)")
      .in("status", ["validado", "ativo"]),
  ]);

  const favoritos = new Set((favs ?? []).map((f) => f.estabelecimento_id));
  const resgatados = new Set<string>();
  const visitados = new Set<string>();
  for (const u of usos ?? []) {
    resgatados.add(u.cupom_id);
    const join = u.cupons as { estabelecimento_id?: string } | { estabelecimento_id?: string }[] | null;
    const est = Array.isArray(join) ? join[0] : join;
    if (est?.estabelecimento_id) visitados.add(est.estabelecimento_id);
  }
  return { favoritos, resgatados, visitados };
}

type ItemHome = Cupom & ItemRecomendacao;

export async function buscarGradeDestaque(
  filtroJa: Awaited<ReturnType<typeof buscarFiltrosTaxonomia>>,
  sinais: SinaisCatalogo,
  cidade?: string,
  limite = 6,
): Promise<{ cupons: Cupom[]; rotulo: string }> {
  const [cupons, consent, prefs, pessoais] = await Promise.all([
    buscarCuponsHome(Math.max(limite, 12), filtroJa),
    sessaoTemPersonalizacao(),
    buscarPreferenciasDaSessao(),
    buscarSinaisPessoais(),
  ]);
  const hoje = hojeBrt();
  const itens: ItemHome[] = cupons.map((c) => {
    const com = comIndicadores(c, sinais);
    return {
      ...com,
      segmentoSlug: com.categoria,
      categoriaFolhaSlug: com.categoriaFolhaSlug,
      publicadoYmd: dataBrt(com.publicadoEm),
      eventos: sinais.eventos.get(com.id) ?? { validacoes7d: 0, ativacoes7d: 0 },
      favorito: pessoais.favoritos.has(com.estabelecimentoId),
      resgatadoPeloUsuario: pessoais.resgatados.has(com.id),
      visitadoPeloUsuario: pessoais.visitados.has(com.estabelecimentoId),
    };
  });
  const ranked = ordenarRecomendacao(itens, {
    consentimentoPersonalizacao: consent,
    perfil: { segmentos: prefs.segmentos, categorias: prefs.categorias },
    hojeYmd: hoje,
    cidade,
  });
  const modo = ranked[0]?.modo ?? "neutro";
  return {
    cupons: ranked.slice(0, limite).map((r) => r.item),
    rotulo: rotuloTrilho(modo, consent),
  };
}
