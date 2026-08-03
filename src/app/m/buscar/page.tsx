import { buscarCuponsBusca } from "@/lib/data/cupons";
import { buscarCategorias, categoriaValida } from "@/lib/data/categorias";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import { BuscarClient } from "./buscar-client";

export const dynamic = "force-dynamic";

/**
 * Busca do consumidor (Fase 4): sai do mock — o catálogo vem do banco
 * com a mesma visibilidade da home (RLS + validade + agendamento).
 * O dia de "hoje" é resolvido aqui (BRT) e desce por prop.
 *
 * Fase 6/H5: recebe `?cat=` e `?dia=` do "Aplicar" de /m/filtros — antes
 * aquele botão descartava a seleção. Os dois são saneados aqui.
 */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: { cat?: string; dia?: string };
}) {
  const [cupons, categorias] = await Promise.all([
    buscarCuponsBusca(),
    buscarCategorias(),
  ]);
  const dias = DIAS_SEMANA as readonly string[];
  return (
    <BuscarClient
      cupons={cupons}
      diaHoje={diaSemanaBrt()}
      categorias={categorias}
      catInicial={categoriaValida(searchParams?.cat, categorias)}
      diaInicial={
        searchParams?.dia && dias.includes(searchParams.dia)
          ? searchParams.dia
          : undefined
      }
    />
  );
}
