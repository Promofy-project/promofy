"use server";

import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { createClient } from "@/lib/supabase/server";
import { linhaParaCupom } from "@/lib/data/cupons";
import type { Database } from "@/lib/supabase/database.types";

// DTOs serializáveis devolvidos ao cliente. Nenhuma action lança:
// erros viram { ok: false, ... } para a UI tratar.
export interface EstadoCupomDTO {
  row_id: number;
  cupom_id: string;
  status: "ativo" | "validado" | "expirado";
  codigo: string;
  ativado_em: string;
  expira_em: string | null;
  nps: number | null;
}
type AtivarResult =
  | { ok: true; ja_ativo: boolean; estado: EstadoCupomDTO }
  | { ok: false; motivo: string };
type ConsultarResult =
  | { ok: true; estado: EstadoCupomDTO | null; saldo: number }
  | { ok: false };
type NpsResult =
  | { ok: true; ja_respondido: boolean; saldo: number }
  | { ok: false; motivo: string };
export interface ValidarDadosDTO {
  codigo: string;
  titulo: string;
  beneficio: string;
  cliente_nome: string;
  cliente_cpf: string;
  validado_em: string;
}
type ValidarResult =
  | { ok: true; dados: ValidarDadosDTO }
  | { ok: false; motivo: string };

/** Consumidor ativa um cupom (regras no servidor via RPC). */
export async function ativarCupomAction(cupomId: string): Promise<AtivarResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("ativar_cupom", { p_cupom_id: cupomId });
    if (error) return { ok: false, motivo: "erro" };
    return data as unknown as AtivarResult;
  } catch {
    return { ok: false, motivo: "erro" };
  }
}

/** Estado atual de um cupom do usuário + saldo (usado pelo polling). */
export async function consultarCupomAction(cupomId: string): Promise<ConsultarResult> {
  try {
    const supabase = createClient();
    const { data: estadoJson } = await supabase.rpc("meu_estado_consumidor");
    const parsed = estadoJson as unknown as {
      saldo?: number;
      estados?: EstadoCupomDTO[];
    } | null;
    const estados = parsed?.estados ?? [];
    // linha mais recente não-expirada do cupom (ativo vigente vence validado)
    const doCupom = estados
      .filter((e) => e.cupom_id === cupomId)
      .sort((a, b) => {
        const rank = (s: string) => (s === "ativo" ? 0 : 1);
        return rank(a.status) - rank(b.status) ||
          b.ativado_em.localeCompare(a.ativado_em);
      });
    return { ok: true, estado: doCupom[0] ?? null, saldo: parsed?.saldo ?? 0 };
  } catch {
    return { ok: false };
  }
}

/** Registra a nota de NPS (uma vez, idempotente no servidor). */
export async function responderNpsAction(rowId: number, nota: number): Promise<NpsResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("responder_nps", {
      p_row_id: rowId,
      p_nota: nota,
    });
    if (error) return { ok: false, motivo: "erro" };
    return data as unknown as NpsResult;
  } catch {
    return { ok: false, motivo: "erro" };
  }
}

/** Evento de app (visualizacao/clique) — fire-and-forget. */
export async function registrarEventoAction(
  cupomId: string,
  tipo: "visualizacao" | "clique",
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc("registrar_evento_cupom", { p_cupom_id: cupomId, p_tipo: tipo });
  } catch {
    /* silencioso — métrica não pode quebrar o fluxo */
  }
}

/** Lojista valida um código apresentado pelo cliente (transação no servidor). */
export async function validarCupomAction(codigo: string): Promise<ValidarResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("validar_cupom", { p_codigo: codigo });
    if (error) return { ok: false, motivo: "erro" };
    return data as unknown as ValidarResult;
  } catch {
    return { ok: false, motivo: "erro" };
  }
}

export interface NovoCupomInput {
  titulo: string;
  beneficio: string;
  categoria: string;
  economia: number;
  validade: string; // yyyy-mm-dd (obrigatório)
  dataInicio?: string;
  ocultarAteInicio: boolean;
  prazoAtivacao: number;
  dias: string[];
  horaInicio: string;
  horaFim: string;
  limiteUsuario: number;
  limiteTotal: number;
}
type CriarResult = { ok: true; item: ItemCupomPortal } | { ok: false; erro: string };

/**
 * Lojista cria um cupom. O estabelecimento_id vem do owner_id do usuário
 * logado (NUNCA do form). Nasce 'pendente' (moderação na Fase 3).
 */
export async function criarCupomAction(input: NovoCupomInput): Promise<CriarResult> {
  try {
    const supabase = createClient();

    if (!input.titulo.trim()) return { ok: false, erro: "Informe o título do cupom." };
    if (!(input.economia > 0)) return { ok: false, erro: "Informe a economia (R$)." };
    if (!input.validade) return { ok: false, erro: "Informe a validade da oferta." };

    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("id, nome")
      .eq("owner_id", uid)
      .maybeSingle();
    if (!est) return { ok: false, erro: "Nenhum estabelecimento vinculado à sua conta." };

    const inteiro = (n: number, min: number) => Math.max(min, Math.trunc(Number(n) || min));
    const descricaoHorario = `${input.dias.length ? input.dias.join(", ") : "Todos os dias"}, ${input.horaInicio} às ${input.horaFim}`;

    const novo: Database["public"]["Tables"]["cupons"]["Insert"] = {
      estabelecimento_id: est.id,
      titulo: input.titulo.trim(),
      categoria_id: input.categoria,
      beneficio: input.beneficio.trim(),
      economia: input.economia,
      validade_inicio: input.dataInicio || null,
      validade_fim: input.validade,
      ocultar_ate_inicio: input.ocultarAteInicio,
      prazo_ativacao_horas: inteiro(input.prazoAtivacao, 1),
      limite_por_usuario: inteiro(input.limiteUsuario, 1),
      limite_total: inteiro(input.limiteTotal, 1),
      regras: input.beneficio.trim() ? [input.beneficio.trim()] : [],
      horarios: { descricao: descricaoHorario, dias: input.dias, inicio: input.horaInicio, fim: input.horaFim },
      status: "pendente",
      imagem: "", // upload de imagem fica p/ fase futura (storage desligado)
    };

    const { data: row, error } = await supabase
      .from("cupons")
      .insert(novo)
      .select("*")
      .single();
    if (error || !row) return { ok: false, erro: "Não foi possível salvar o cupom." };

    const item: ItemCupomPortal = {
      cupom: linhaParaCupom(row, est.nome),
      statusPortal: "pendente",
      metricas: { visualizacoes: 0, cliques: 0, ativacoes: 0, resgates: 0 },
      limiteTotal: row.limite_total ?? 1000,
      dataInicio: row.validade_inicio ?? undefined,
      ocultarAteInicio: row.ocultar_ate_inicio,
    };
    return { ok: true, item };
  } catch {
    return { ok: false, erro: "Não foi possível salvar o cupom." };
  }
}
