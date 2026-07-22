import { buscarCuponsBusca } from "@/lib/data/cupons";
import { diaSemanaBrt } from "@/lib/dias";
import { BuscarClient } from "./buscar-client";

export const dynamic = "force-dynamic";

/**
 * Busca do consumidor (Fase 4): sai do mock — o catálogo vem do banco
 * com a mesma visibilidade da home (RLS + validade + agendamento).
 * O dia de "hoje" é resolvido aqui (BRT) e desce por prop.
 */
export default async function BuscarPage() {
  const cupons = await buscarCuponsBusca();
  return <BuscarClient cupons={cupons} diaHoje={diaSemanaBrt()} />;
}
