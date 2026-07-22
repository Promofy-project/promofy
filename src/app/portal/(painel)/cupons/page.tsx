import { buscarCuponsPortal } from "@/lib/data/cupons";
import { buscarCategoriasEstab } from "@/lib/data/estab";
import { CuponsClient } from "./cupons-client";

/**
 * Server component: lê os cupons do estabelecimento do lojista logado
 * no Supabase (métricas derivadas de cupom_eventos) e entrega ao corpo
 * client. Fase 4: também as N categorias do estabelecimento (junção),
 * para o seletor do novo cupom. `cookies()` já torna a rota dinâmica.
 */
export default async function PortalCupons() {
  const { estabelecimento, itens } = await buscarCuponsPortal();
  const categorias = estabelecimento
    ? await buscarCategoriasEstab(estabelecimento.id, estabelecimento.categoriaId)
    : [];
  return (
    <CuponsClient
      initialLista={itens}
      estabelecimentoNome={estabelecimento?.nome ?? "Seu estabelecimento"}
      categorias={categorias}
      categoriaPrincipal={estabelecimento?.categoriaId ?? null}
    />
  );
}
