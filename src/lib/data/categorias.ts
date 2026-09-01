import "server-only";

import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import type { CategoriaVisual } from "@/lib/categoria-visual";

/** Categoria como as telas do consumidor precisam dela (rótulo + id). */
export interface CategoriaFiltro {
  id: string;
  label: string;
}

/**
 * O catálogo de FILTROS de descoberta — o que a UI oferece para filtrar
 * a busca (chips da home, /m/buscar, /m/filtros), na ordem de produto,
 * já com o visual (icon/gradiente) usado pelos cards e avatares (TX-P1:
 * fonte única, nada de `src/lib/mock-data.ts` para dado operacional).
 *
 * TX-P2AF: NÃO é o catálogo de categorias operacionais do admin/portal
 * (vínculo estabelecimento↔categoria, seleção no form de cupom) — para
 * isso é `buscarCatalogoCategorias()` em `src/lib/data/taxonomia.ts`.
 * As duas coincidem hoje porque os dois catálogos leem a mesma tabela
 * legado; depois do cutover este vira 14 segmentos e o operacional vira
 * as categorias folha — não são mais a mesma lista. Um nome genérico
 * `buscarCategorias()` já escondeu essa colisão uma vez; não reintroduzir.
 *
 * Existe porque os chips da home listavam
 * ["alimentação","lazer","compras","serviços","saúde","beleza"] — e QUATRO
 * desses seis não existem no banco (backlog 12.3). Um chip de "lazer" não
 * pode filtrar nada: não há cupom de lazer.
 *
 * Lê a FRONTEIRA `catalogo_filtros`, nunca a tabela física — ver
 * src/lib/data/taxonomia.ts. Leitura pública, então serve a visitante e a
 * logado igual. Banco fora do ar → lista vazia: a home simplesmente não
 * mostra a faixa de chips, em vez de quebrar.
 */
export async function buscarFiltrosPublicos(): Promise<CategoriaVisual[]> {
  return (await buscarFiltrosTaxonomia()).catalogo;
}

/**
 * Sanea o `?cat=` LEGADO da URL contra os filtros de SEGMENTO.
 *
 * Marco 3A: a URL canônica é `?seg=` / `?cat=` (folha). Este helper
 * continua existindo para o `?cat=<segmento>` do Marco 2, e para qualquer
 * chamada que ainda trate o param como slug de segmento. Valor
 * desconhecido vira "sem filtro" e NUNCA chega a virar predicado.
 */
export function categoriaValida(
  cat: string | undefined,
  categorias: CategoriaFiltro[],
): string | undefined {
  if (!cat) return undefined;
  return categorias.some((c) => c.id === cat) ? cat : undefined;
}
