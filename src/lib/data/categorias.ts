import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CategoriaVisual } from "@/lib/categoria-visual";

/** Categoria como as telas do consumidor precisam dela (rótulo + id). */
export interface CategoriaFiltro {
  id: string;
  label: string;
}

/**
 * As categorias REAIS do catálogo (tabela `categorias`), na ordem definida
 * pelo produto — já com o visual (icon/gradiente) usado pelos cards e
 * avatares (TX-P1: fonte única, nada de `src/lib/mock-data.ts` para dado
 * operacional).
 *
 * Existe porque os chips da home listavam
 * ["alimentação","lazer","compras","serviços","saúde","beleza"] — e QUATRO
 * desses seis não existem no banco (backlog 12.3). Um chip de "lazer" não
 * pode filtrar nada: não há cupom de lazer.
 *
 * Leitura pública (a policy de `categorias` libera anon), então serve a
 * visitante e a logado igual. Banco fora do ar → lista vazia: a home
 * simplesmente não mostra a faixa de chips, em vez de quebrar.
 */
export async function buscarCategorias(): Promise<CategoriaVisual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, label, icon, gradiente")
    .order("ordem", { ascending: true });
  if (error) return [];
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    gradiente: c.gradiente,
  }));
}

/**
 * Sanea o `?cat=` da URL contra as categorias reais.
 *
 * Query param é entrada de usuário: valor desconhecido vira "sem filtro", e
 * NUNCA chega a virar predicado de consulta. Sem isto, um `?cat=xpto`
 * devolveria zero cupons e a home pareceria vazia/quebrada.
 */
export function categoriaValida(
  cat: string | undefined,
  categorias: CategoriaFiltro[],
): string | undefined {
  if (!cat) return undefined;
  return categorias.some((c) => c.id === cat) ? cat : undefined;
}
