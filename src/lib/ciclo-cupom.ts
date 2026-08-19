/**
 * O ciclo de vida do cupom, visto pelo lojista — Fase 9/D1.
 *
 * MÓDULO PURO: sem `server-only`, sem DOM, sem `Intl` (datas comparadas como
 * texto ISO `YYYY-MM-DD`, que ordena lexicograficamente — o mesmo truque do
 * resto da casa para não depender de fuso do dispositivo).
 *
 * POR QUE ESTE MÓDULO EXISTE:
 *
 * `esgotado` é ESTADO no banco desde a migration 33: nasce dentro de
 * `validar_cupom`, na transação em que a última validação alcança
 * `limite_total`. Aqui só se lê.
 *
 * `expirado` é DERIVADO da data, e continua sendo. Não há job varrendo a
 * tabela para carimbar vencimento — a data já responde, e a coluna só muda
 * quando o lojista mexe no cupom (aí o trigger da 33 assume). A consequência
 * é que existe um cupom `ativo` no banco cuja validade já passou, e o Portal
 * precisa mostrá-lo como o que ele é: encerrado.
 *
 * Esta função é o único lugar que faz essa tradução. O app nativo vai
 * precisar exatamente dela.
 */
import type { StatusCupomPortal } from "./types";

/** Status como o banco guarda (o enum `status_cupom`). */
export type StatusCupomBanco =
  | "ativo"
  | "indisponivel"
  | "expirado"
  | "esgotado"
  | "pendente"
  | "rejeitado"
  | "excluido";

/**
 * O status que o lojista vê.
 *
 * `indisponivel` colapsa em "ativo" (é oscilação operacional, não fim de
 * campanha) e um `ativo` com validade vencida aparece como "expirado" — a
 * tradução que a D1 acrescentou.
 *
 * `hoje` entra como parâmetro em vez de ser lido aqui: quem sabe qual é o
 * "hoje do negócio" (BRT) é o chamador, e uma função que consulta o relógio
 * não é testável sem esperar o dia virar.
 */
export function statusPortalDe(
  statusBanco: string,
  validadeFim: string | null | undefined,
  hoje: string,
): StatusCupomPortal {
  switch (statusBanco) {
    case "excluido":
      return "excluido";
    case "esgotado":
      return "esgotado";
    case "expirado":
      return "expirado";
    case "pendente":
      return "pendente";
    case "rejeitado":
      return "rejeitado";
    default:
      // ativo | indisponivel — só a data separa "no ar" de "encerrado".
      return validadeFim && validadeFim < hoje ? "expirado" : "ativo";
  }
}

/** O cupom acabou por validade? (mesma comparação de `filtrarVisiveis`) */
export function venceu(validadeFim: string | null | undefined, hoje: string): boolean {
  return Boolean(validadeFim && validadeFim < hoje);
}

/**
 * Prorrogar é uma ação de cupom EXPIRADO — e só faz sentido com data futura.
 *
 * A barreira real é o trigger da migration 33 (que ninguém contorna nem pelo
 * PostgREST); esta função existe para a tela poder desabilitar o botão e
 * dizer o motivo antes de o servidor recusar.
 */
export function podeProrrogar(
  statusPortal: StatusCupomPortal,
  novaValidadeFim: string | null | undefined,
  hoje: string,
): boolean {
  return statusPortal === "expirado" && Boolean(novaValidadeFim) && novaValidadeFim! >= hoje;
}

/**
 * A ação que o card oferece em cada estado — a D1 em uma tabela.
 *
 * `esgotado` NÃO reativa: campanha encerrada vira campanha nova, com id
 * próprio, para que métricas, ativações e NPS não se misturem entre duas
 * vidas do mesmo cupom (decisão de produto da D1). `expirado` é a MESMA
 * campanha continuando, então prorroga no lugar.
 */
export type AcaoCiclo = "editar" | "reenviar" | "prorrogar" | "nova_campanha" | "nenhuma";

export function acoesDoCard(statusPortal: StatusCupomPortal): AcaoCiclo[] {
  switch (statusPortal) {
    case "excluido":
      return ["nenhuma"];
    case "esgotado":
      return ["nova_campanha"];
    case "expirado":
      return ["prorrogar"];
    case "rejeitado":
      return ["editar", "reenviar"];
    default:
      return ["editar"];
  }
}
