import { buscarCuponsPortal } from "@/lib/data/cupons";
import { CuponsEstabClient } from "./cupons-client";

export const dynamic = "force-dynamic";

export default async function CuponsPage() {
  const { itens } = await buscarCuponsPortal();
  return <CuponsEstabClient itens={itens} />;
}
