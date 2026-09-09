/**
 * Galeria do PERFIL do estabelecimento — regra pura (CLIENT-RETURNS-03).
 *
 * Módulo PURO: sem `server-only`, sem DOM, sem `Intl`, sem `Buffer`. Roda no
 * servidor, na suíte e, sem uma linha de mudança, no app nativo. Importe por
 * caminho relativo nas suítes (o alias `@/` é do tsconfig do Next).
 *
 * O QUE É ESTA GALERIA
 *
 * Fotos do local, do ambiente, dos produtos e do cardápio — o complemento
 * visual do PERFIL. Não é a imagem principal do cupom (`cupons.imagem`), não
 * é galeria de cupom e não é a logo (`estabelecimentos.logo`). Os três
 * continuam existindo e nenhum deles muda por causa deste arquivo.
 *
 * A ORDEM É DETERMINÍSTICA POR CONSTRUÇÃO
 *
 * `ordem` sozinha empata: duas imagens adicionadas antes de qualquer
 * reordenação nascem ambas com a posição que a Action calculou, e um empate
 * não resolvido faria a mesma galeria aparecer em ordens diferentes entre um
 * SSR e o seguinte. `ordenarGaleria` desempata por `criadoEm` e depois por
 * `id` — dois critérios totais, então nunca sobra empate real.
 */

/**
 * GUARD TÉCNICO, não regra comercial.
 *
 * O cliente não pediu teto nenhum. Este número existe para o sistema não
 * aceitar uma galeria de 500 fotos num perfil; se um dia virar regra de
 * produto (plano, preço), a decisão é do produto e muda aqui **e** no trigger
 * `private.checar_limite_galeria` da migration 43 — que é a fronteira real.
 */
export const MAX_IMAGENS_GALERIA = 12;

/**
 * Proporção do recorte da galeria (largura / altura).
 *
 * 4:3 e não o 2:1 do card de cupom: a faixa larga existe porque o card do
 * cupom é uma faixa larga. A galeria é um grid de fotos de ambiente e produto,
 * onde 2:1 decapitaria metade do que o lojista enquadrou.
 */
export const ASPECTO_IMAGEM_GALERIA = 4 / 3;

/** Largura máxima do JPEG exportado. O grid não precisa de 4K. */
export const LARGURA_EXPORT_GALERIA = 1200;

export interface ItemGaleria {
  id: string;
  imagem: string;
  ordem: number;
  criadoEm: string;
}

/**
 * Ordem estável da galeria. NÃO muta a entrada — a lista vem de um server
 * component e é reusada pela UI.
 */
export function ordenarGaleria<T extends ItemGaleria>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    if (a.criadoEm !== b.criadoEm) return a.criadoEm < b.criadoEm ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Posição da próxima imagem: sempre no fim, sem reaproveitar buraco. */
export function proximaOrdemGaleria(itens: readonly ItemGaleria[]): number {
  let maior = -1;
  for (const i of itens) if (i.ordem > maior) maior = i.ordem;
  return maior + 1;
}

export function galeriaCheia(quantidade: number): boolean {
  return quantidade >= MAX_IMAGENS_GALERIA;
}

/**
 * Nova ordem depois de mover UM item uma posição para a esquerda/direita.
 *
 * Botões em vez de drag-and-drop: o projeto não tem nenhuma dependência de
 * DnD, e a alternativa acessível de um DnD (teclado, leitor de tela) é
 * exatamente este par de botões. Um clique = uma troca = uma chamada.
 *
 * Devolve a lista INTEIRA de ids na ordem desejada — que é o que a RPC
 * `reordenar_galeria_estabelecimento` espera. Movimento impossível (primeiro
 * para a esquerda, último para a direita, id ausente) devolve `null`, e quem
 * chama não faz viagem nenhuma.
 */
export function moverNaGaleria(
  ids: readonly string[],
  id: string,
  direcao: "esquerda" | "direita",
): string[] | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const j = direcao === "esquerda" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  const novo = [...ids];
  novo[i] = ids[j];
  novo[j] = ids[i];
  return novo;
}

/**
 * Texto alternativo da imagem.
 *
 * NÃO inventa descrição do conteúdo da foto — ninguém aqui sabe o que ela
 * mostra, e um alt inventado é pior que um alt genérico: ele mente para quem
 * depende dele. Descreve o que se pode afirmar: de quem é a imagem e qual é,
 * de quantas.
 */
export function altImagemGaleria(
  nomeEstabelecimento: string,
  indice: number,
  total: number,
): string {
  const nome = nomeEstabelecimento.trim();
  const de = nome ? ` do estabelecimento ${nome}` : " do estabelecimento";
  if (total <= 1) return `Imagem${de}`;
  return `Imagem ${indice + 1} de ${total}${de}`;
}
