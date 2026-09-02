import { redirect } from "next/navigation";

import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import { buscarCatalogoFiltrado } from "@/lib/data/descoberta";
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
import {
  extraDeFiltro,
  filtroConsumidorDeQuery,
} from "@/lib/filtros-consumidor";
import { BuscarClient } from "./buscar-client";

export const dynamic = "force-dynamic";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: {
    seg?: string | string[];
    cat?: string | string[];
    dia?: string | string[];
    cidade?: string | string[];
    bairro?: string | string[];
    promo?: string | string[];
    consumo?: string | string[];
    min?: string | string[];
    perto?: string | string[];
    trilho?: string | string[];
  };
}) {
  const filtroTax = await buscarFiltrosTaxonomia();
  const categorias = filtroTax.catalogo;

  const bruto = filtroDeQuery(searchParams);
  const filtro = normalizarFiltroUrl(bruto, filtroTax.catalogoUrl);
  const dia = diaDeQuery(searchParams?.dia, DIAS_SEMANA);
  const filtroCons = filtroConsumidorDeQuery(searchParams);

  if (precisaCanonicalizar(bruto, filtro) || queryPrecisaLimpeza(searchParams)) {
    redirect(hrefBusca(filtro, extraDeFiltro(filtroCons, dia)));
  }

  const ids = idsParaConsulta(filtro, filtroTax.catalogoUrl);
  const cupons = await buscarCatalogoFiltrado(ids, filtroCons, filtroTax);

  return (
    <BuscarClient
      cupons={cupons}
      diaHoje={diaSemanaBrt()}
      catalogo={filtroTax.catalogoUrl}
      catalogoVazio={categorias.length === 0}
      filtro={filtro}
      diaInicial={dia}
      filtroCons={filtroCons}
    />
  );
}
