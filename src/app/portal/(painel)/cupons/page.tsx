import { buscarCuponsPortal } from "@/lib/data/cupons";
import { CuponsClient } from "./cupons-client";

/**
 * Server component: lê os cupons do estabelecimento do lojista logado
 * no Supabase (métricas derivadas de cupom_eventos) e entrega ao corpo
 * client. `cookies()` via client supabase já torna a rota dinâmica.
 */
export default async function PortalCupons() {
  const lista = await buscarCuponsPortal();
  return <CuponsClient initialLista={lista} />;
}
