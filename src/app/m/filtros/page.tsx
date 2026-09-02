import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import { buscarLocaisPublicos } from "@/lib/data/descoberta";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import { diaDeQuery, filtroDeQuery, normalizarFiltroUrl } from "@/lib/taxonomia-url";
import { filtroConsumidorDeQuery } from "@/lib/filtros-consumidor";
import { FiltrosClient } from "./filtros-client";

export const dynamic = "force-dynamic";

export default async function FiltrosPage({
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
  const [filtroTax, locais] = await Promise.all([
    buscarFiltrosTaxonomia(),
    buscarLocaisPublicos(),
  ]);
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
      locais={locais}
      filtroConsInicial={filtroConsumidorDeQuery(searchParams)}
    />
  );
}
