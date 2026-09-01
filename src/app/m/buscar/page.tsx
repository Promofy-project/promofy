import { redirect } from "next/navigation";

import { buscarCuponsBusca } from "@/lib/data/cupons";
import { buscarFiltrosPublicos } from "@/lib/data/categorias";
import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import {
  hrefBusca,
  idsParaConsulta,
  normalizarFiltroUrl,
  precisaCanonicalizar,
} from "@/lib/taxonomia-url";
import { BuscarClient } from "./buscar-client";

export const dynamic = "force-dynamic";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: { seg?: string; cat?: string; dia?: string };
}) {
  const [categorias, filtroTax] = await Promise.all([
    buscarFiltrosPublicos(),
    buscarFiltrosTaxonomia(),
  ]);

  const bruto = { seg: searchParams?.seg, cat: searchParams?.cat };
  const filtro = normalizarFiltroUrl(bruto, filtroTax.catalogoUrl);
  const dias = DIAS_SEMANA as readonly string[];
  const dia =
    searchParams?.dia && dias.includes(searchParams.dia)
      ? searchParams.dia
      : undefined;

  if (precisaCanonicalizar(bruto, filtro)) {
    redirect(hrefBusca(filtro, { dia }));
  }

  const ids = idsParaConsulta(filtro, filtroTax.catalogoUrl);
  const cupons = await buscarCuponsBusca(ids);

  return (
    <BuscarClient
      cupons={cupons}
      diaHoje={diaSemanaBrt()}
      catalogo={filtroTax.catalogoUrl}
      catalogoVazio={categorias.length === 0}
      filtro={filtro}
      diaInicial={dia}
    />
  );
}
