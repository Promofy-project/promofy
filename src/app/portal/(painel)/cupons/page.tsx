import { buscarCuponsPortal } from "@/lib/data/cupons";
import { buscarCategoriasEstab } from "@/lib/data/estab";
import { buscarCatalogoResolucao } from "@/lib/data/taxonomia";
import { CuponsClient } from "./cupons-client";

/**
 * Server component: lê os cupons do estabelecimento do lojista logado
 * no Supabase (métricas derivadas de cupom_eventos) e entrega ao corpo
 * client. Fase 4: também as N categorias do estabelecimento (junção),
 * para o seletor do novo cupom. `cookies()` já torna a rota dinâmica.
 */
export default async function PortalCupons({
  searchParams,
}: {
  searchParams?: { novo?: string };
}) {
  const [{ estabelecimento, itens }, catalogoVisual] = await Promise.all([
    buscarCuponsPortal(),
    buscarCatalogoResolucao(),
  ]);
  // MARCO 2A — `ativo` governa NOVA SELEÇÃO, não o que já existe. O
  // seletor oferece as folhas ainda em catálogo MAIS as que os cupons
  // deste estabelecimento já usam: sem a segunda metade, abrir para editar
  // um cupom cuja categoria saiu do catálogo mostraria o campo sem rótulo,
  // e salvar um ajuste de título exigiria recategorizar sem que ninguém
  // tivesse pedido. O uuid da folha vem de `categoriaVisual.id`, que é o
  // que `visualDe` resolve (`cupom.categoria` é o slug do SEGMENTO).
  const folhasEmUso = new Set(
    itens.flatMap((i) => (i.cupom.categoriaVisual?.id ? [i.cupom.categoriaVisual.id] : [])),
  );
  const categorias = estabelecimento
    ? (await buscarCategoriasEstab(estabelecimento.id, estabelecimento.categoriaId)).filter(
        (c) => c.ativo || folhasEmUso.has(c.id),
      )
    : [];
  return (
    <CuponsClient
      initialLista={itens}
      estabelecimentoNome={estabelecimento?.nome ?? "Seu estabelecimento"}
      estabelecimentoId={estabelecimento?.id ?? null}
      categorias={categorias}
      categoriaPrincipal={estabelecimento?.categoriaId ?? null}
      catalogoVisual={catalogoVisual}
      abrirEmNovo={searchParams?.novo === "1"}
    />
  );
}
