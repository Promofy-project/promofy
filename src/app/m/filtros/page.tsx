import { buscarFiltrosPublicos } from "@/lib/data/categorias";
import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import { normalizarFiltroUrl } from "@/lib/taxonomia-url";
import { FiltrosClient } from "./filtros-client";

export const dynamic = "force-dynamic";

export default async function FiltrosPage({
  searchParams,
}: {
  searchParams?: { seg?: string; cat?: string; dia?: string };
}) {
  const [categorias, filtroTax] = await Promise.all([
    buscarFiltrosPublicos(),
    buscarFiltrosTaxonomia(),
  ]);
  const dias = DIAS_SEMANA as readonly string[];
  const filtro = normalizarFiltroUrl(
    { seg: searchParams?.seg, cat: searchParams?.cat },
    filtroTax.catalogoUrl,
  );
  return (
    <FiltrosClient
      catalogo={filtroTax.catalogoUrl}
      catalogoVazio={categorias.length === 0}
      filtroInicial={filtro}
      diaHoje={diaSemanaBrt()}
      diaInicial={
        searchParams?.dia && dias.includes(searchParams.dia)
          ? searchParams.dia
          : undefined
      }
    />
  );
}
