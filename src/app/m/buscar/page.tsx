import { redirect } from "next/navigation";

import { buscarCuponsBusca } from "@/lib/data/cupons";
import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import {
  diaDeQuery,
  filtroDeQuery,
  hrefBusca,
  idsParaConsulta,
  normalizarFiltroUrl,
  precisaCanonicalizar,
  queryPrecisaLimpeza,
} from "@/lib/taxonomia-url";
import { BuscarClient } from "./buscar-client";

export const dynamic = "force-dynamic";

export default async function BuscarPage({
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

  const bruto = filtroDeQuery(searchParams);
  const filtro = normalizarFiltroUrl(bruto, filtroTax.catalogoUrl);
  const dia = diaDeQuery(searchParams?.dia, DIAS_SEMANA);

  if (precisaCanonicalizar(bruto, filtro) || queryPrecisaLimpeza(searchParams)) {
    redirect(hrefBusca(filtro, { dia }));
  }

  const ids = idsParaConsulta(filtro, filtroTax.catalogoUrl);
  const cupons = await buscarCuponsBusca(ids, filtroTax);

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
