/**
 * Filtros da listagem de cupons do lojista (portal e /e).
 *
 * MÓDULO PURO: sem `server-only`, sem DOM, sem `Intl`. A decisão de o que
 * entra na lista filtrada não é assunto do React — o app nativo vai
 * renderizar outra coisa e precisa da MESMA resposta.
 *
 * Compõe com `portal-listagem` (aba de status / arquivados). Aqui ficam
 * os atributos do cupom: categoria, dia da semana, forma de consumo.
 * Tudo client-side sobre a lista já carregada — a listagem do lojista
 * é pequena, e ir ao servidor a cada toque seria N+1 de latência.
 */
import { cupomDisponivelNoDia } from "./dias";
import { filtrarPorAba } from "./portal-listagem";

export interface ItemFiltroLojista {
  statusPortal: string;
  /** Folha UUID (`categoriaVisual.id` / `categoria_nova_id`). */
  categoriaId?: string | null;
  dias?: string[];
  formasConsumo?: string[];
}

export interface FiltrosAtributoLojista {
  /** Folha UUID, ou `""` = todas. */
  categoriaId: string;
  /** Label canônico de `DIAS_SEMANA`, ou `""` = todos. */
  dia: string;
  /** Id de `FORMAS_CONSUMO`, ou `""` = todas. */
  formaConsumo: string;
}

export const FILTROS_ATRIBUTO_VAZIOS: FiltrosAtributoLojista = {
  categoriaId: "",
  dia: "",
  formaConsumo: "",
};

export function filtrosAtributoAtivos(f: FiltrosAtributoLojista): boolean {
  return Boolean(f.categoriaId || f.dia || f.formaConsumo);
}

/**
 * Atributos (categoria/dia/forma) sobre uma lista JÁ recortada pela aba.
 * Não muta `itens`.
 */
export function filtrarAtributosLojista<T extends ItemFiltroLojista>(
  itens: readonly T[],
  filtros: FiltrosAtributoLojista,
): T[] {
  return itens.filter((i) => {
    if (filtros.categoriaId && (i.categoriaId ?? "") !== filtros.categoriaId) {
      return false;
    }
    if (filtros.dia && !cupomDisponivelNoDia(i.dias, filtros.dia)) {
      return false;
    }
    if (filtros.formaConsumo) {
      const formas = i.formasConsumo ?? [];
      if (!formas.includes(filtros.formaConsumo)) return false;
    }
    return true;
  });
}

/** Aba de status + atributos, sem mutar a fonte. */
export function filtrarListagemLojista<T extends ItemFiltroLojista>(
  itens: readonly T[],
  aba: string,
  filtros: FiltrosAtributoLojista,
): T[] {
  return filtrarAtributosLojista(filtrarPorAba([...itens], aba), filtros);
}
