import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { filtrosAuditCrm } from "@/lib/crm-audit-filtros";
import type {
  CrmClienteResumo,
  CrmFiltro,
  CrmHistoricoItem,
  CrmExportHistoricoItem,
  CrmResumo,
} from "@/lib/crm-tipos";

export type {
  CrmClienteResumo,
  CrmFiltro,
  CrmHistoricoItem,
  CrmExportHistoricoItem,
  CrmResumo,
} from "@/lib/crm-tipos";
export { crmCampoOuNaoInformado } from "@/lib/crm-tipos";

export interface CrmListaResultado {
  ok: boolean;
  motivo?: string;
  estabelecimentoId: string | null;
  total: number;
  pagina: number;
  porPagina: number;
  resumo: CrmResumo;
  clientes: CrmClienteResumo[];
}

export interface CrmDetalheResultado {
  ok: boolean;
  motivo?: string;
  estabelecimentoId?: string;
  cliente?: CrmClienteResumo;
  historico: CrmHistoricoItem[];
}

export interface CrmExportDados {
  ok: boolean;
  motivo?: string;
  estabelecimentoId: string | null;
  clientes: CrmClienteResumo[];
  historico: CrmExportHistoricoItem[];
}

export interface CrmContextoSessao {
  ok: boolean;
  motivo?: string;
  estabelecimentoId: string | null;
  nome: string | null;
}

const RESUMO_VAZIO: CrmResumo = {
  clientesUnicos: 0,
  novos30d: 0,
  recorrentes: 0,
  resgatesConfirmados: 0,
};

function mapCliente(raw: Record<string, unknown>): CrmClienteResumo {
  return {
    usuarioId: String(raw.usuario_id ?? ""),
    nome: (raw.nome as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    telefone: (raw.telefone as string | null) ?? null,
    nascimento: (raw.nascimento as string | null) ?? null,
    totalResgates: Number(raw.total_resgates ?? 0),
    primeiroResgate: (raw.primeiro_resgate as string | null) ?? null,
    ultimoResgate: (raw.ultimo_resgate as string | null) ?? null,
  };
}

function mapHistorico(raw: Record<string, unknown>): CrmHistoricoItem {
  return {
    cupomId: String(raw.cupom_id ?? ""),
    titulo: String(raw.titulo ?? ""),
    beneficio: String(raw.beneficio ?? ""),
    economia: raw.economia == null ? null : Number(raw.economia),
    economiaVariavel: Boolean(raw.economia_variavel),
    validadoEm: (raw.validado_em as string | null) ?? null,
    status: String(raw.status ?? ""),
    nps: raw.nps == null ? null : Number(raw.nps),
  };
}

/** Mesma regra que as RPCs CRM: `private.crm_estab_da_sessao` (order by id). */
export async function buscarContextoCrmDaSessao(): Promise<CrmContextoSessao> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("crm_contexto_sessao");

  if (error) {
    return {
      ok: false,
      motivo: error.message,
      estabelecimentoId: null,
      nome: null,
    };
  }

  const r = data as Record<string, unknown> | null;
  if (!r || r.ok !== true) {
    return {
      ok: false,
      motivo: String(r?.motivo ?? "erro"),
      estabelecimentoId: null,
      nome: null,
    };
  }

  return {
    ok: true,
    estabelecimentoId: (r.estabelecimento_id as string | null) ?? null,
    nome: (r.nome as string | null) ?? null,
  };
}

export async function buscarCrmClientes(opts: {
  q?: string | null;
  filtro?: CrmFiltro | string | null;
  pagina?: number;
  porPagina?: number;
}): Promise<CrmListaResultado> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("crm_clientes", {
    p_q: opts.q?.trim() || undefined,
    p_filtro: opts.filtro || "todos",
    p_pagina: opts.pagina ?? 1,
    p_por_pagina: opts.porPagina ?? 20,
  });

  if (error) {
    return {
      ok: false,
      motivo: error.message,
      estabelecimentoId: null,
      total: 0,
      pagina: opts.pagina ?? 1,
      porPagina: opts.porPagina ?? 20,
      resumo: RESUMO_VAZIO,
      clientes: [],
    };
  }

  const r = data as Record<string, unknown> | null;
  if (!r || r.ok !== true) {
    return {
      ok: false,
      motivo: String(r?.motivo ?? "erro"),
      estabelecimentoId: null,
      total: 0,
      pagina: opts.pagina ?? 1,
      porPagina: opts.porPagina ?? 20,
      resumo: RESUMO_VAZIO,
      clientes: [],
    };
  }

  const resumoRaw = (r.resumo ?? {}) as Record<string, unknown>;
  const clientesRaw = Array.isArray(r.clientes) ? (r.clientes as Record<string, unknown>[]) : [];

  return {
    ok: true,
    estabelecimentoId: (r.estabelecimento_id as string | null) ?? null,
    total: Number(r.total ?? 0),
    pagina: Number(r.pagina ?? 1),
    porPagina: Number(r.por_pagina ?? 20),
    resumo: {
      clientesUnicos: Number(resumoRaw.clientes_unicos ?? 0),
      novos30d: Number(resumoRaw.novos_30d ?? 0),
      recorrentes: Number(resumoRaw.recorrentes ?? 0),
      resgatesConfirmados: Number(resumoRaw.resgates_confirmados ?? 0),
    },
    clientes: clientesRaw.map(mapCliente),
  };
}

export async function buscarCrmClienteDetalhe(
  usuarioId: string,
): Promise<CrmDetalheResultado> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("crm_cliente_detalhe", {
    p_usuario_id: usuarioId,
  });

  if (error) {
    return { ok: false, motivo: error.message, historico: [] };
  }

  const r = data as Record<string, unknown> | null;
  if (!r || r.ok !== true) {
    return {
      ok: false,
      motivo: String(r?.motivo ?? "nao_encontrado"),
      historico: [],
    };
  }

  const clienteRaw = r.cliente as Record<string, unknown> | null;
  const histRaw = Array.isArray(r.historico)
    ? (r.historico as Record<string, unknown>[])
    : [];

  return {
    ok: true,
    estabelecimentoId: r.estabelecimento_id as string | undefined,
    cliente: clienteRaw ? mapCliente(clienteRaw) : undefined,
    historico: histRaw.map(mapHistorico),
  };
}

export async function buscarCrmExportDados(opts: {
  q?: string | null;
  filtro?: CrmFiltro | string | null;
}): Promise<CrmExportDados> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("crm_export_dados", {
    p_q: opts.q?.trim() || undefined,
    p_filtro: opts.filtro || "todos",
  });

  if (error) {
    return {
      ok: false,
      motivo: error.message,
      estabelecimentoId: null,
      clientes: [],
      historico: [],
    };
  }

  const r = data as Record<string, unknown> | null;
  if (!r || r.ok !== true) {
    return {
      ok: false,
      motivo: String(r?.motivo ?? "erro"),
      estabelecimentoId: null,
      clientes: [],
      historico: [],
    };
  }

  const clientesRaw = Array.isArray(r.clientes)
    ? (r.clientes as Record<string, unknown>[])
    : [];
  const histRaw = Array.isArray(r.historico)
    ? (r.historico as Record<string, unknown>[])
    : [];

  return {
    ok: true,
    estabelecimentoId: (r.estabelecimento_id as string | null) ?? null,
    clientes: clientesRaw.map(mapCliente),
    historico: histRaw.map((h) => ({
      ...mapHistorico(h),
      usuarioId: String(h.usuario_id ?? ""),
      nome: (h.nome as string | null) ?? null,
    })),
  };
}

export async function registrarCrmExportacao(opts: {
  formato: "xlsx" | "pdf";
  linhasClientes: number;
  linhasHistorico: number;
  q?: string | null;
  filtro?: CrmFiltro | string | null;
}): Promise<{ ok: boolean; motivo?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("crm_registrar_exportacao", {
    p_formato: opts.formato,
    p_linhas_clientes: opts.linhasClientes,
    p_linhas_historico: opts.linhasHistorico,
    p_filtros: filtrosAuditCrm(opts.q, opts.filtro) as unknown as Json,
  });

  if (error) return { ok: false, motivo: error.message };
  const r = data as Record<string, unknown> | null;
  if (!r || r.ok !== true) {
    return { ok: false, motivo: String(r?.motivo ?? "erro") };
  }
  return { ok: true };
}
