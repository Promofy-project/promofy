/**
 * Construtor do PATCH de edição de cupom (Fase 6.5/C2) — módulo PURO.
 *
 * POR QUE ISTO NÃO MORA DENTRO DA SERVER ACTION
 *
 * Esta é a peça que impede a perda silenciosa de dado documentada no plano:
 * o formulário do `/e` é um subconjunto DECLARADO do cupom (não tem estado
 * para dias/horário/agendamento/prazo). Se a edição gravasse o input inteiro,
 * corrigir um typo no título pelo totem apagaria a janela, o agendamento, o
 * prazo, as regras e a imagem — e, como três desses são materiais, ainda
 * rebaixaria um cupom `ativo` para `pendente`, sumindo da vitrine. Três
 * canais independentes para o mesmo desastre, nenhum deles com mensagem de
 * erro.
 *
 * A regra que evita isso é uma decisão de dados, não de I/O: "grava só o que
 * veio". Como decisão de dados, ela é testável sem servidor, sem cookies e
 * sem banco — e é o que a suíte da fase faz. Dentro da Action ela seria
 * inalcançável para o teste (a Action depende de `cookies()` do Next), e a
 * única prova possível seria indireta, via banco, deixando o construtor
 * livre para regredir.
 *
 * O que FICA na Action: a validação de `categoria`, que precisa consultar as
 * categorias do estabelecimento no banco.
 *
 * Módulo puro no sentido da fase: sem "server-only", sem DOM, sem Intl. O app
 * nativo vai ter um formulário reduzido também — e vai herdar esta barreira.
 */
import type { Database } from "./supabase/database.types";
import {
  PRAZO_ATIVACAO_MIN_HORAS,
  sanearFormasConsumo,
  sanearLimite,
  sanearPrazoAtivacao,
  sanearTaxas,
} from "./cupom-campos";

export type PatchCupom = Database["public"]["Tables"]["cupons"]["Update"];

/** Campos editáveis. Tudo opcional: ausente = "não mexer". */
export interface CamposEdicaoCupom {
  titulo?: string;
  beneficio?: string;
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

export type PatchResult =
  | { ok: true; patch: PatchCupom }
  | { ok: false; erro: string };

const horaValida = (h: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test((h ?? "").trim());

/**
 * Campos → patch, gravando SÓ as chaves presentes.
 *
 * `undefined` nunca vira default, nunca vira `""`, nunca vira `[]`. Cada
 * saneador só roda se a chave veio — `prazoAtivacao` ausente não passa por
 * `sanearPrazoAtivacao` (senão um form que não expõe o campo o reescreveria
 * para o mínimo a cada edição).
 */
export function montarPatchCupom(campos: CamposEdicaoCupom): PatchResult {
  const patch: PatchCupom = {};

  if (campos.titulo !== undefined) {
    if (!campos.titulo.trim()) return { ok: false, erro: "Informe o título do cupom." };
    patch.titulo = campos.titulo.trim();
  }
  if (campos.beneficio !== undefined) patch.beneficio = campos.beneficio.trim();
  if (campos.economia !== undefined) {
    if (!(campos.economia > 0)) return { ok: false, erro: "Informe a economia (R$)." };
    patch.economia = campos.economia;
  }
  if (campos.economiaVariavel !== undefined) {
    patch.economia_variavel = Boolean(campos.economiaVariavel);
  }
  if (campos.validade !== undefined) {
    if (!campos.validade) return { ok: false, erro: "Informe a validade da oferta." };
    patch.validade_fim = campos.validade;
  }
  if (campos.dataInicio !== undefined) patch.validade_inicio = campos.dataInicio || null;
  if (campos.ocultarAteInicio !== undefined) {
    patch.ocultar_ate_inicio = campos.ocultarAteInicio;
  }
  if (campos.prazoAtivacao !== undefined) {
    if (Math.trunc(Number(campos.prazoAtivacao)) < PRAZO_ATIVACAO_MIN_HORAS) {
      return {
        ok: false,
        erro: `O prazo de ativação deve ser de no mínimo ${PRAZO_ATIVACAO_MIN_HORAS} horas.`,
      };
    }
    patch.prazo_ativacao_horas = sanearPrazoAtivacao(campos.prazoAtivacao);
  }
  if (campos.taxas !== undefined) patch.taxas = sanearTaxas(campos.taxas);
  if (campos.formasConsumo !== undefined) {
    patch.formas_consumo = sanearFormasConsumo(campos.formasConsumo);
  }
  if (campos.regras !== undefined) {
    patch.regras = campos.regras.map((r) => r.trim()).filter(Boolean);
  }
  if (campos.imagem !== undefined) patch.imagem = campos.imagem;
  if (campos.limiteUsuario !== undefined || campos.limiteUsuarioIlimitado !== undefined) {
    patch.limite_por_usuario = sanearLimite(
      campos.limiteUsuario,
      Boolean(campos.limiteUsuarioIlimitado),
    );
  }
  if (campos.limiteTotal !== undefined || campos.limiteTotalIlimitado !== undefined) {
    patch.limite_total = sanearLimite(campos.limiteTotal, Boolean(campos.limiteTotalIlimitado));
  }

  // `horarios` é jsonb COMPOSTO: recebê-lo pela metade é o mesmo bug em
  // miniatura (gravaria uma janela que o lojista não pediu). Ou vêm os três,
  // ou não se toca no campo.
  const temJanela =
    campos.dias !== undefined &&
    campos.horaInicio !== undefined &&
    campos.horaFim !== undefined;
  if (temJanela) {
    const hi = horaValida(campos.horaInicio!) ? campos.horaInicio!.trim() : null;
    const hf = horaValida(campos.horaFim!) ? campos.horaFim!.trim() : null;
    const diasLimpos = (campos.dias ?? []).filter(
      (d) => typeof d === "string" && d.length > 0,
    );
    const faixa = hi && hf ? `${hi} às ${hf}` : "qualquer horário";
    const descricao = `${diasLimpos.length ? diasLimpos.join(", ") : "Todos os dias"}, ${faixa}`;
    patch.horarios =
      hi && hf
        ? { descricao, dias: diasLimpos, inicio: hi, fim: hf }
        : { descricao, dias: diasLimpos };
  } else if (
    campos.dias !== undefined ||
    campos.horaInicio !== undefined ||
    campos.horaFim !== undefined
  ) {
    return {
      ok: false,
      erro: "Para alterar o horário, informe dias, início e fim juntos.",
    };
  }

  return { ok: true, patch };
}
