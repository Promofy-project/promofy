/**
 * A listagem de cupons do portal — Fase 9/C5.
 *
 * MÓDULO PURO: sem `server-only`, sem DOM, sem `Intl`. A regra de o que o
 * lojista vê em cada aba não é assunto do React — o app nativo vai
 * renderizar outra coisa e precisa da MESMA resposta. Por isso a decisão
 * mora aqui e o componente só desenha o resultado.
 *
 * O QUE ESTA CAMADA DECIDE, e por quê:
 *
 * A Onda C4 deu ao lojista a exclusão lógica. Ela funciona: o status vira
 * `excluido`, o histórico fica inteiro e o consumidor deixa de ver o cupom.
 * O que ela NÃO fez foi tirar o cupom da gestão do dia a dia — ele
 * continuava em "Todos", ao lado dos ativos, e a validação manual em
 * produção registrou a leitura inevitável: "eu excluí, mas ele continua
 * aqui".
 *
 * A correção é de significado, não de dado: **"Todos" quer dizer todos os
 * cupons OPERACIONAIS** — os que ainda participam do negócio. O arquivado
 * não some do sistema, some da mesa de trabalho; ele continua inteiro na
 * aba "Excluídos", que é onde o histórico se consulta.
 *
 * Nada aqui apaga item de lista nenhuma: a fonte continua sendo a lista
 * completa. Filtrar na leitura, e não na fonte, é o que permite que o mesmo
 * registro alimente "Excluídos" no instante seguinte à exclusão, sem
 * segunda ida ao servidor.
 */

/** O status já colapsado para as telas do portal. */
export interface ItemListavel {
  statusPortal: string;
}

/** Id da aba: um `statusPortal` ou o agregador `todos`. */
export const ABA_TODOS = "todos";

/**
 * Os status ARQUIVADOS — fora da visão operacional.
 *
 * Uma lista, e não `=== "excluido"`, porque arquivamento é um conceito de
 * produto que pode ganhar outro membro (um "encerrado" futuro, por
 * exemplo). Quando ganhar, esta é a única linha a mudar — e as abas, os
 * contadores e o filtro acompanham sozinhos.
 */
export const STATUS_ARQUIVADOS = ["excluido"] as const;

export function ehArquivado(statusPortal: string): boolean {
  return (STATUS_ARQUIVADOS as readonly string[]).includes(statusPortal);
}

/** O que "Todos" mostra: a lista sem os arquivados. */
export function listaOperacional<T extends ItemListavel>(itens: T[]): T[] {
  return itens.filter((i) => !ehArquivado(i.statusPortal));
}

/**
 * Contadores por aba.
 *
 * `todos` conta a lista OPERACIONAL — é o número que precisa cair quando o
 * lojista exclui. Cada status conta a lista INTEIRA, senão "Excluídos"
 * nasceria zerado justamente quando passa a ter conteúdo.
 */
export function contarPorAba<T extends ItemListavel>(itens: T[]): Record<string, number> {
  const c: Record<string, number> = { [ABA_TODOS]: listaOperacional(itens).length };
  for (const i of itens) c[i.statusPortal] = (c[i.statusPortal] ?? 0) + 1;
  return c;
}

/** O conteúdo de uma aba. `todos` esconde arquivados; qualquer outra é exata. */
export function filtrarPorAba<T extends ItemListavel>(itens: T[], aba: string): T[] {
  return aba === ABA_TODOS
    ? listaOperacional(itens)
    : itens.filter((i) => i.statusPortal === aba);
}

/**
 * A aba que de fato vale.
 *
 * O filtro escolhido pode deixar de existir debaixo do dedo do lojista:
 * excluir o último rejeitado zera "Rejeitados", e um filtro apontando para
 * uma aba que sumiu deixaria a tela vazia sem nenhuma aba marcada. Derivado
 * — a escolha do lojista continua guardada e volta a valer se a aba
 * reaparecer.
 */
export function abaEfetiva(abasVisiveis: readonly string[], escolhida: string): string {
  return abasVisiveis.includes(escolhida) ? escolhida : ABA_TODOS;
}
