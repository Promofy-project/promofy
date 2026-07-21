import { EstabPhoneFrame } from "@/components/estab/estab-phone-frame";
import { EstabProvider, type EstabInfo } from "@/components/estab/estab-provider";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout do app do estabelecimento (/e). Lê a sessão (cookies → dinâmico) e
 * hidrata o estabelecimento do lojista por owner_id, num try/catch que degrada
 * (banco fora não derruba a rota). NÃO monta os providers do consumidor.
 */
export default async function EstabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let estab: EstabInfo | null = null;

  try {
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (uid) {
      const { data } = await supabase
        .from("estabelecimentos")
        .select("id, nome, status")
        .eq("owner_id", uid)
        .maybeSingle();
      if (data) {
        estab = { id: data.id, nome: data.nome, status: data.status };
      }
    }
  } catch {
    estab = null;
  }

  return (
    <EstabProvider value={estab}>
      <EstabPhoneFrame>{children}</EstabPhoneFrame>
    </EstabProvider>
  );
}
