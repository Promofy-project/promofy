import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  buscarConsentimentoPersonalizacao,
  buscarPreferenciasDaSessao,
} from "@/lib/data/preferencias";
import { PreferenciasForm, PreferenciasShell } from "./preferencias-form";

export const dynamic = "force-dynamic";

export default async function PreferenciasPage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/m/login");

  const [prefs, consentimento] = await Promise.all([
    buscarPreferenciasDaSessao(),
    buscarConsentimentoPersonalizacao(),
  ]);

  return (
    <PreferenciasShell>
      <PreferenciasForm inicial={prefs} consentimento={consentimento} />
    </PreferenciasShell>
  );
}
