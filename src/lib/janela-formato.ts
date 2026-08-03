/**
 * Formatação legível da janela de consumo do cupom (dias + faixa de horário).
 *
 * POR QUE ISTO EXISTE (backlog 12.1, observado no ar numa sexta às 14h):
 * a tabela "Regras de Uso" do detalhe era uma CONSTANTE literal — "Hoje,
 * Quinta", "09:00 - 16:00" em todos os dias — ao lado de um botão que a
 * MESMA tela esmaece pela janela real do cupom. O consumidor lia um horário
 * e o botão obedecia a outro. Era a única contradição visível que a barreira
 * da Fase 5 introduziu, e ela morava ao lado do botão.
 *
 * Aqui não há regra de negócio: quem decide se o cupom pode ser consumido é
 * `dentro_da_janela` no servidor, espelhado por `dentroDaJanela` em
 * ./janela. Este módulo só DESCREVE o mesmo objeto `JanelaConsumo` que
 * alimenta aquela decisão — por isso a contradição fica estruturalmente
 * impossível: é um dado só.
 *
 * As tolerâncias são as MESMAS do SQL e do espelho TS, de propósito: dado
 * malformado é "sem restrição", nunca "fora da janela". Se `dentroDaJanela`
 * ignora um horário inválido, esta tela não pode anunciá-lo.
 *
 * Módulo puro: sem "server-only", sem DOM, sem Intl, sem toLocaleString.
 * Import relativo (e não "@/lib/dias") pelo mesmo motivo de ./janela — esta
 * camada será copiada tal e qual para o app nativo e não deve depender do
 * alias de path do tsconfig do Next.
 */
import { DIAS_SEMANA, type DiaSemana } from "./dias";
import type { JanelaConsumo } from "./janela";

/** Uma linha da tabela "Regras de Uso" — um dia da semana. */
export interface LinhaJanela {
  dia: DiaSemana;
  /** O cupom pode ser consumido neste dia? */
  permitido: boolean;
  /** "18:00 às 23:00" · "Qualquer horário" · "—" quando o dia não vale. */
  faixa: string;
  /** Dia de hoje em BRT (resolvido no servidor e passado por prop). */
  hoje: boolean;
}

/** Mesma tolerância de `emMinutos` em ./janela: "8:00" e "08:00" valem. */
const HORA_VALIDA = /^([0-9]{1,2}):([0-9]{2})$/;

/** "HH:MM" saneado, ou null (vazio/lixo/hora impossível = sem restrição). */
function horaLimpa(valor: string | undefined | null): string | null {
  if (typeof valor !== "string") return null;
  const m = HORA_VALIDA.exec(valor.trim());
  if (!m) return null;
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return valor.trim();
}

/** A faixa de horário do cupom, ou null quando não há restrição de hora. */
export function faixaHorario(janela: JanelaConsumo | null | undefined): string | null {
  if (!janela || typeof janela !== "object") return null;
  const inicio = horaLimpa(janela.inicio);
  const fim = horaLimpa(janela.fim);
  // um só dos dois não restringe nada (é o que dentroDaJanela faz)
  if (!inicio || !fim) return null;
  return `${inicio} às ${fim}`;
}

/**
 * O cupom restringe alguma coisa? Sem restrição não faz sentido desenhar
 * uma tabela de 7 linhas iguais — a tela mostra uma frase.
 */
export function temRestricao(janela: JanelaConsumo | null | undefined): boolean {
  if (!janela || typeof janela !== "object") return false;
  const dias = janela.dias;
  const restringeDia = Array.isArray(dias) && dias.length > 0;
  return restringeDia || faixaHorario(janela) !== null;
}

/**
 * As 7 linhas canônicas da tabela, na ordem de DIAS_SEMANA.
 *
 * `diaHoje` vem SEMPRE do servidor (`diaSemanaBrt()`): o "hoje" do cliente
 * na Vercel é UTC e marcaria o dia errado à noite — o mesmo cuidado que a
 * Fase 4 tomou no chip "HOJE" da busca e a Fase 5 no botão.
 */
export function linhasDaJanela(
  janela: JanelaConsumo | null | undefined,
  diaHoje: DiaSemana,
): LinhaJanela[] {
  const dias = janela?.dias;
  const restringeDia = Array.isArray(dias) && dias.length > 0;
  const faixa = faixaHorario(janela) ?? "Qualquer horário";

  return DIAS_SEMANA.map((dia) => {
    const permitido =
      !restringeDia ||
      dias.some((d) => d === dia || (dia === "Sáb" && d === "Sab")); // tolera sem acento
    return { dia, permitido, faixa: permitido ? faixa : "—", hoje: dia === diaHoje };
  });
}
