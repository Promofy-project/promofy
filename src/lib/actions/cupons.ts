"use server";

import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { createClient } from "@/lib/supabase/server";
import {
  buscarCupomParaEdicao,
  linhaParaCupom,
  type CupomParaEdicao,
} from "@/lib/data/cupons";
import {
  PRAZO_ATIVACAO_MIN_HORAS,
  sanearFormasConsumo,
  sanearLimite,
  sanearPrazoAtivacao,
  sanearTaxas,
} from "@/lib/cupom-campos";
import { economiaDeJson, type EconomiaDTO } from "@/lib/economia";
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
  /** Pontos que o banco creditou POR ESTE resgate (Fase 5) — 0 se não validado. */
  pontos_resgate?: number;
}

/**
 * Quantas vezes o usuário já consumiu um cupom e quantas ainda restam
 * (Fase 5). `consumidos` usa a MESMA regra de `ativar_cupom`: validadas
 * + ativas vigentes. É o insumo do selo "utilizado" — sem `restantes`
 * não dá para distinguir "acabou" de "ainda tem uso sobrando".
 */
export interface UsoCupomDTO {
  cupom_id: string;
  consumidos: number;
  /** Fase 6: null = ilimitado. */
  limite: number | null;
  /** Fase 6: null quando ilimitado — DADO DE EXIBIÇÃO, nunca condição. */
  restantes: number | null;
  /**
   * Fase 6: "ainda posso usar este cupom?" decidido NO SERVIDOR, com a
   * negação literal da checagem de `ativar_cupom`.
   *
   * Existe porque a UI derivava isso sozinha e errava: `restantes > 0`
   * dá false tanto para `null` quanto para `0`, então cupom ilimitado
   * exibia o selo "Utilizado" e não oferecia a 2ª ativação, embora o
   * servidor fosse aceitá-la. Quem lê este campo NUNCA deve voltar a
   * comparar `restantes` num `if`.
   */
  pode_reusar: boolean;
}

// `EconomiaDTO` e `economiaDeJson` vivem em @/lib/economia: num arquivo
// "use server" todo export precisa ser função async, e um helper síncrono
// aqui derruba o `next build` — restrição que o `tsc` não pega.

type AtivarResult =
  | { ok: true; ja_ativo: boolean; estado: EstadoCupomDTO }
  | { ok: false; motivo: string };
type ConsultarResult =
  | {
      ok: true;
      estado: EstadoCupomDTO | null;
      saldo: number;
      economia: EconomiaDTO;
      usos: UsoCupomDTO[];
    }
  | { ok: false };
type NpsResult =
  | { ok: true; ja_respondido: boolean; saldo: number; pontos: number }
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
    // meu_estado_consumidor (saldo + estados) e economia (RPC própria,
    // security definer) no mesmo ciclo do poll — pontos e economia sobem
    // juntos ao detectar a validação.
    // Fase 6: `economia_consumidor` devolve {total, inclui_variavel}. A
    // antiga `economia_total_consumidor` (numeric) segue existindo no
    // banco para a janela de deploy banco-antes-código; o app novo não
    // a usa mais.
    const [{ data: estadoJson }, { data: economiaData }] = await Promise.all([
      supabase.rpc("meu_estado_consumidor"),
      supabase.rpc("economia_consumidor"),
    ]);
    const parsed = estadoJson as unknown as {
      saldo?: number;
      estados?: EstadoCupomDTO[];
      usos?: UsoCupomDTO[];
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
    return {
      ok: true,
      estado: doCupom[0] ?? null,
      saldo: parsed?.saldo ?? 0,
      economia: economiaDeJson(economiaData),
      // `usos` vai junto de propósito: navegação client-side não
      // re-renderiza o layout (Partial Rendering) e nada dá
      // router.refresh() no fluxo do consumidor — sem isto o selo
      // "utilizado" só apareceria depois de um F5.
      usos: parsed?.usos ?? [],
    };
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
  /** Fase 6: com `economiaVariavel`, é a economia MÍNIMA garantida. */
  economia: number;
  economiaVariavel?: boolean;
  validade: string; // yyyy-mm-dd (obrigatório)
  dataInicio?: string;
  ocultarAteInicio: boolean;
  prazoAtivacao: number;
  dias: string[];
  horaInicio: string;
  horaFim: string;
  limiteUsuario: number;
  limiteTotal: number;
  /** Fase 6: `true` grava NULL na coluna — o vocabulário de "sem teto". */
  limiteUsuarioIlimitado?: boolean;
  limiteTotalIlimitado?: boolean;
  /** Fase 6: ids de src/lib/cupom-campos (saneados aqui no servidor). */
  taxas?: string[];
  formasConsumo?: string[];
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
    if (!(input.economia > 0)) {
      return {
        ok: false,
        erro: input.economiaVariavel
          ? "Informe a economia mínima garantida (R$)."
          : "Informe a economia (R$).",
      };
    }
    if (!input.validade) return { ok: false, erro: "Informe a validade da oferta." };
    // Fase 6: prazo mínimo de ativação é REGRA, não sugestão do form —
    // recusa explícita em vez de clamp silencioso, para o lojista saber
    // que o valor dele não foi aceito. (A 3ª barreira é o CHECK da
    // coluna, que cobre o PATCH direto via PostgREST.)
    if (Math.trunc(Number(input.prazoAtivacao)) < PRAZO_ATIVACAO_MIN_HORAS) {
      return {
        ok: false,
        erro: `O prazo de ativação deve ser de no mínimo ${PRAZO_ATIVACAO_MIN_HORAS} horas.`,
      };
    }

    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("id, nome, categoria_id")
      .eq("owner_id", uid)
      .maybeSingle();
    if (!est) return { ok: false, erro: "Nenhum estabelecimento vinculado à sua conta." };

    // Fase 4: a categoria escolhida DEVE pertencer ao conjunto do
    // estabelecimento (junção). Ausente → principal. Fora do conjunto →
    // rejeitada aqui; o trigger checar_categoria_cupom é a 2ª barreira
    // (barra também o PostgREST direto).
    const { data: cats } = await supabase
      .from("estabelecimento_categorias")
      .select("categoria_id")
      .eq("estabelecimento_id", est.id);
    const conjunto = new Set((cats ?? []).map((c) => c.categoria_id));
    conjunto.add(est.categoria_id); // invariante: principal ∈ conjunto
    const categoriaId = input.categoria || est.categoria_id;
    if (!conjunto.has(categoriaId)) {
      return { ok: false, erro: "Categoria inválida para o seu estabelecimento." };
    }

    // Fase 5 — hora malformada vira CHAVE OMITIDA, nunca string vazia.
    // Os <input type="time"> do form não são `required`: limpar os campos
    // gravava {"inicio":"","fim":""}, e a janela de consumo (dentro_da_janela)
    // teria de decidir o que fazer com isso. Ela já trata (malformado = sem
    // restrição), mas gravar sujeira no jsonb é a origem do problema.
    const horaValida = (h: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test((h ?? "").trim());
    const hi = horaValida(input.horaInicio) ? input.horaInicio.trim() : null;
    const hf = horaValida(input.horaFim) ? input.horaFim.trim() : null;
    const diasLimpos = (input.dias ?? []).filter((d) => typeof d === "string" && d.length > 0);

    const faixa = hi && hf ? `${hi} às ${hf}` : "qualquer horário";
    const descricaoHorario = `${diasLimpos.length ? diasLimpos.join(", ") : "Todos os dias"}, ${faixa}`;
    // literal inline (e não montado por partes) para o TS conferir contra Json
    const horarios =
      hi && hf
        ? { descricao: descricaoHorario, dias: diasLimpos, inicio: hi, fim: hf }
        : { descricao: descricaoHorario, dias: diasLimpos };

    const novo: Database["public"]["Tables"]["cupons"]["Insert"] = {
      estabelecimento_id: est.id,
      titulo: input.titulo.trim(),
      // Fase 4 (evolui a D2): o form escolhe entre as N categorias do
      // estabelecimento; o servidor valida contra a junção (acima).
      categoria_id: categoriaId,
      beneficio: input.beneficio.trim(),
      economia: input.economia,
      economia_variavel: Boolean(input.economiaVariavel),
      validade_inicio: input.dataInicio || null,
      validade_fim: input.validade,
      ocultar_ate_inicio: input.ocultarAteInicio,
      prazo_ativacao_horas: sanearPrazoAtivacao(input.prazoAtivacao),
      // Fase 6: `null` = ilimitado, o mesmo vocabulário nas duas colunas.
      limite_por_usuario: sanearLimite(
        input.limiteUsuario,
        Boolean(input.limiteUsuarioIlimitado),
      ),
      limite_total: sanearLimite(
        input.limiteTotal,
        Boolean(input.limiteTotalIlimitado),
      ),
      // Fase 6: o jsonb não tem CHECK de domínio (de propósito — ver a
      // migration 16); o vocabulário é garantido AQUI, no servidor, e
      // nunca no form. Valor desconhecido é descartado, não rejeitado:
      // o cupom sendo salvo importa mais do que uma taxa que o cliente
      // não reconhece.
      taxas: sanearTaxas(input.taxas),
      formas_consumo: sanearFormasConsumo(input.formasConsumo),
      regras: input.beneficio.trim() ? [input.beneficio.trim()] : [],
      horarios,
      // O trigger `forcar_status_pendente` (migration 19) garante isto
      // mesmo se alguém chamar o PostgREST direto; aqui é explícito.
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
      limiteUsuario: row.limite_por_usuario,
      dataInicio: row.validade_inicio ?? undefined,
      ocultarAteInicio: row.ocultar_ate_inicio,
    };
    return { ok: true, item };
  } catch {
    return { ok: false, erro: "Não foi possível salvar o cupom." };
  }
}

/**
 * Entrada de EDIÇÃO — PARCIAL, e isso é o ponto (Fase 6.5).
 *
 * NÃO é `NovoCupomInput`. O formulário do `/e` é um subconjunto declarado:
 * ele não tem estado para dias/horário/agendamento/prazo e manda LITERAIS
 * no submit (`dias: []`, `horaInicio: "00:00"`, `prazoAtivacao: 5`…), e a
 * `criarCupomAction` ainda acrescenta `regras: [beneficio]` e `imagem: ""`.
 * Se a edição aceitasse o input completo, corrigir um typo no título pelo
 * totem APAGARIA a janela, o agendamento, o prazo, as regras curadas e a
 * imagem — e, como horarios/regras/imagem são materiais, ainda rebaixaria o
 * cupom para 'pendente', tirando-o da vitrine.
 *
 * Regra desta action: **só grava as chaves que vieram**. `undefined` nunca
 * vira default, nunca vira "" e nunca vira [].
 */
type CarregarEdicaoResult =
  | { ok: true; cupom: CupomParaEdicao }
  | { ok: false; erro: string };

/**
 * Carrega o cupom para pré-preencher o formulário de edição.
 *
 * Existe como Action (e não como fetch no client) porque a leitura é feita
 * sob a sessão do lojista no SERVIDOR — a RLS `cupons: lojista le os
 * proprios` é quem garante que ele não abra o cupom de outro. O portal é um
 * client component e não tem como chamar `buscarCupomParaEdicao` direto
 * (ela é `server-only`).
 */
export async function carregarCupomParaEdicaoAction(
  cupomId: string,
): Promise<CarregarEdicaoResult> {
  try {
    const cupom = await buscarCupomParaEdicao(cupomId);
    if (!cupom) return { ok: false, erro: "Cupom não encontrado no seu estabelecimento." };
    return { ok: true, cupom };
  } catch {
    return { ok: false, erro: "Não foi possível abrir o cupom para edição." };
  }
}

type ReenviarResult = { ok: true } | { ok: false; erro: string };

/** Lojista devolve o próprio cupom rejeitado à fila de moderação (C5). */
export async function reenviarCupomAction(cupomId: string): Promise<ReenviarResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("reenviar_cupom_moderacao", {
      p_cupom_id: cupomId,
    });
    if (error) return { ok: false, erro: "Não foi possível reenviar o cupom." };
    const r = data as unknown as { ok?: boolean; motivo?: string } | null;
    if (r?.ok) return { ok: true };
    const MSG: Record<string, string> = {
      sem_sessao: "Sessão expirada. Entre novamente.",
      sem_permissao: "Este cupom não é do seu estabelecimento.",
      nao_rejeitado: "Só é possível reenviar um cupom que foi rejeitado.",
      nao_encontrado: "Cupom não encontrado.",
    };
    return { ok: false, erro: MSG[r?.motivo ?? ""] ?? "Não foi possível reenviar o cupom." };
  } catch {
    return { ok: false, erro: "Não foi possível reenviar o cupom." };
  }
}

export interface EditarCupomInput {
  id: string;
  titulo?: string;
  beneficio?: string;
  categoria?: string;
  economia?: number;
  economiaVariavel?: boolean;
  validade?: string;
  dataInicio?: string | null;
  ocultarAteInicio?: boolean;
  prazoAtivacao?: number;
  /** jsonb COMPOSTO: só é remontado se os três vierem juntos. */
  dias?: string[];
  horaInicio?: string;
  horaFim?: string;
  limiteUsuario?: number;
  limiteTotal?: number;
  limiteUsuarioIlimitado?: boolean;
  limiteTotalIlimitado?: boolean;
  taxas?: string[];
  formasConsumo?: string[];
  regras?: string[];
  imagem?: string;
}

type EditarResult = { ok: true; item: ItemCupomPortal } | { ok: false; erro: string };

/** Mensagens dos SQLSTATEs do trigger `checar_edicao_cupom` (migration 20). */
const ERRO_EDICAO = new Set(["P0601", "P0602", "P0603", "P0604", "P0605", "P0606"]);

/**
 * Lojista edita o próprio cupom. A REGRA vive no trigger (barreira real,
 * cobre o PostgREST direto); aqui é a camada de mensagem — a action não
 * reimplementa a matriz, ela traduz o que o banco recusou.
 */
export async function editarCupomAction(
  input: EditarCupomInput,
): Promise<EditarResult> {
  try {
    const supabase = createClient();
    if (!input.id) return { ok: false, erro: "Cupom não informado." };

    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("id, nome, categoria_id")
      .eq("owner_id", uid)
      .maybeSingle();
    if (!est) return { ok: false, erro: "Nenhum estabelecimento vinculado à sua conta." };

    // Monta o patch CHAVE A CHAVE. Cada saneador só roda se a chave veio.
    const patch: Database["public"]["Tables"]["cupons"]["Update"] = {};

    if (input.titulo !== undefined) {
      if (!input.titulo.trim()) return { ok: false, erro: "Informe o título do cupom." };
      patch.titulo = input.titulo.trim();
    }
    if (input.beneficio !== undefined) patch.beneficio = input.beneficio.trim();
    if (input.economia !== undefined) {
      if (!(input.economia > 0)) return { ok: false, erro: "Informe a economia (R$)." };
      patch.economia = input.economia;
    }
    if (input.economiaVariavel !== undefined) {
      patch.economia_variavel = Boolean(input.economiaVariavel);
    }
    if (input.validade !== undefined) {
      if (!input.validade) return { ok: false, erro: "Informe a validade da oferta." };
      patch.validade_fim = input.validade;
    }
    if (input.dataInicio !== undefined) patch.validade_inicio = input.dataInicio || null;
    if (input.ocultarAteInicio !== undefined) {
      patch.ocultar_ate_inicio = input.ocultarAteInicio;
    }
    if (input.prazoAtivacao !== undefined) {
      if (Math.trunc(Number(input.prazoAtivacao)) < PRAZO_ATIVACAO_MIN_HORAS) {
        return {
          ok: false,
          erro: `O prazo de ativação deve ser de no mínimo ${PRAZO_ATIVACAO_MIN_HORAS} horas.`,
        };
      }
      patch.prazo_ativacao_horas = sanearPrazoAtivacao(input.prazoAtivacao);
    }
    if (input.taxas !== undefined) patch.taxas = sanearTaxas(input.taxas);
    if (input.formasConsumo !== undefined) {
      patch.formas_consumo = sanearFormasConsumo(input.formasConsumo);
    }
    if (input.regras !== undefined) {
      patch.regras = input.regras.map((r) => r.trim()).filter(Boolean);
    }
    if (input.imagem !== undefined) patch.imagem = input.imagem;
    if (input.limiteUsuario !== undefined || input.limiteUsuarioIlimitado !== undefined) {
      patch.limite_por_usuario = sanearLimite(
        input.limiteUsuario,
        Boolean(input.limiteUsuarioIlimitado),
      );
    }
    if (input.limiteTotal !== undefined || input.limiteTotalIlimitado !== undefined) {
      patch.limite_total = sanearLimite(
        input.limiteTotal,
        Boolean(input.limiteTotalIlimitado),
      );
    }
    if (input.categoria !== undefined) {
      const { data: cats } = await supabase
        .from("estabelecimento_categorias")
        .select("categoria_id")
        .eq("estabelecimento_id", est.id);
      const conjunto = new Set((cats ?? []).map((c) => c.categoria_id));
      conjunto.add(est.categoria_id);
      if (!conjunto.has(input.categoria)) {
        return { ok: false, erro: "Categoria inválida para o seu estabelecimento." };
      }
      patch.categoria_id = input.categoria;
    }

    // `horarios` é jsonb COMPOSTO: recebê-lo pela metade é o mesmo bug em
    // miniatura (gravaria uma janela que o lojista não pediu). Ou vêm os
    // três, ou não se toca no campo.
    const temJanela =
      input.dias !== undefined &&
      input.horaInicio !== undefined &&
      input.horaFim !== undefined;
    if (temJanela) {
      const horaValida = (h: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test((h ?? "").trim());
      const hi = horaValida(input.horaInicio!) ? input.horaInicio!.trim() : null;
      const hf = horaValida(input.horaFim!) ? input.horaFim!.trim() : null;
      const diasLimpos = (input.dias ?? []).filter(
        (d) => typeof d === "string" && d.length > 0,
      );
      const faixa = hi && hf ? `${hi} às ${hf}` : "qualquer horário";
      const descricao = `${diasLimpos.length ? diasLimpos.join(", ") : "Todos os dias"}, ${faixa}`;
      patch.horarios =
        hi && hf
          ? { descricao, dias: diasLimpos, inicio: hi, fim: hf }
          : { descricao, dias: diasLimpos };
    } else if (
      input.dias !== undefined ||
      input.horaInicio !== undefined ||
      input.horaFim !== undefined
    ) {
      return {
        ok: false,
        erro: "Para alterar o horário, informe dias, início e fim juntos.",
      };
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, erro: "Nada para alterar." };
    }

    const { data: row, error } = await supabase
      .from("cupons")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .maybeSingle();

    if (error) {
      // O trigger fala a linguagem do lojista — repassar é melhor do que
      // traduzir para uma frase genérica que esconde o motivo.
      if (ERRO_EDICAO.has(error.code ?? "")) return { ok: false, erro: error.message };
      return { ok: false, erro: "Não foi possível salvar as alterações." };
    }
    // 0 linhas = a policy filtrou (cupom de outro estabelecimento).
    if (!row) return { ok: false, erro: "Cupom não encontrado no seu estabelecimento." };

    const item: ItemCupomPortal = {
      cupom: linhaParaCupom(row, est.nome),
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
      metricas: { visualizacoes: 0, cliques: 0, ativacoes: 0, resgates: 0 },
      limiteTotal: row.limite_total ?? 1000,
      limiteUsuario: row.limite_por_usuario,
      dataInicio: row.validade_inicio ?? undefined,
      ocultarAteInicio: row.ocultar_ate_inicio,
    };
    return { ok: true, item };
  } catch {
    return { ok: false, erro: "Não foi possível salvar as alterações." };
  }
}
