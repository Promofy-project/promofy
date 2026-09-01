import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import { diaDeQuery, filtroDeQuery, normalizarFiltroUrl } from "@/lib/taxonomia-url";
import { FiltrosClient } from "./filtros-client";

export const dynamic = "force-dynamic";

export default async function FiltrosPage({
  searchParams,
}: {
  searchParams?: {
    seg?: string | string[];
    cat?: string | string[];
    dia?: string | string[];
  };
}) {
  const filtroTax = await buscarFiltrosTaxonomia();
  const categorias = filtroTax.catalogo;
  const filtro = normalizarFiltroUrl(
    filtroDeQuery(searchParams),
    filtroTax.catalogoUrl,
  );
  return (
    <FiltrosClient
      catalogo={filtroTax.catalogoUrl}
      catalogoVazio={categorias.length === 0}
      filtroInicial={filtro}
      diaHoje={diaSemanaBrt()}
      diaInicial={diaDeQuery(searchParams?.dia, DIAS_SEMANA)}
    />
  );
}
