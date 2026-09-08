import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  buscarAceitesDaSessao,
  buscarStatusContaDaSessao,
} from "@/lib/data/legal";
import { TODOS_DOCUMENTOS_LEGAIS } from "@/lib/documentos-legais";
import { PrivacidadeShell, PrivacidadeClient } from "./privacidade-client";

export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/m/login");

  const [aceites, status] = await Promise.all([
    buscarAceitesDaSessao(),
    buscarStatusContaDaSessao(),
  ]);

  const aceitosPorDoc = new Map(aceites.map((a) => [a.documento, a]));
  const documentos = TODOS_DOCUMENTOS_LEGAIS.map((doc) => ({
    ...doc,
    aceito: aceitosPorDoc.get(doc.documento) ?? null,
  }));

  return (
    <PrivacidadeShell>
      <PrivacidadeClient documentos={documentos} status={status ?? "ativo"} />
    </PrivacidadeShell>
  );
}
