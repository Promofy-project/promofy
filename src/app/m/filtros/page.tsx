import { buscarCategorias, categoriaValida } from "@/lib/data/categorias";
import { DIAS_SEMANA, diaSemanaBrt } from "@/lib/dias";
import { FiltrosClient } from "./filtros-client";

export const dynamic = "force-dynamic";

/**
 * Filtros do consumidor (backlog 12.3).
 *
 * Antes: SETE seções de opções literais (Categoria com rótulos que não
 * existem no banco, Localização, Promoção, Frequência de uso, Valor de
 * compra, Relevância, Dia da semana) e um "Aplicar" que era
 * `<Link href="/m">` — navegava de volta e DESCARTAVA a seleção inteira.
 *
 * Agora: só as duas seções com lastro no modelo — Categoria (tabela
 * `categorias`) e Dia da semana (`cupons.horarios.dias`) — e o "Aplicar"
 * leva os parâmetros para /m/buscar, onde o filtro por dia JÁ funcionava
 * desde a Fase 4 e o de categoria entra agora.
 *
 * As cinco seções removidas não tinham dado nenhum por trás: localização,
 * promoção, frequência e valor de compra não existem no schema, e
 * relevância/afinidade dependem da taxonomia Segmento→Categoria. Ficam
 * registradas no backlog daquela fase — meia tela de filtro que não filtra
 * é pior do que uma tela honesta.
 */
export default async function FiltrosPage({
  searchParams,
}: {
  searchParams?: { cat?: string; dia?: string };
}) {
  const categorias = await buscarCategorias();
  const dias = DIAS_SEMANA as readonly string[];
  return (
    <FiltrosClient
      categorias={categorias}
      catInicial={categoriaValida(searchParams?.cat, categorias)}
      // "hoje" resolvido NO SERVIDOR (BRT): o relógio do cliente na Vercel
      // é UTC e marcaria o dia errado à noite — mesmo cuidado do /m/buscar.
      diaHoje={diaSemanaBrt()}
      diaInicial={
        searchParams?.dia && dias.includes(searchParams.dia)
          ? searchParams.dia
          : undefined
      }
    />
  );
}
