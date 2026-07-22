"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Sincroniza o Router Cache do cliente com a sessão real (Fase 4 · bug2).
 *
 * O /m é SPA App Router: ao voltar para a home por link interno ou pelo botão
 * "voltar", o Next serve o payload do Router Cache. Se a sessão expirou nesse
 * meio-tempo, a home reaparece LOGADA com pontos velhos — o servidor renderiza
 * certo, mas o cache do cliente mente (nada em /m revalidava a sessão).
 *
 * Aqui um listener de auth compara a sessão do browser com o que o servidor
 * renderizou (`serverLogado`) e, no descompasso, chama router.refresh() — que
 * invalida o Router Cache e re-renderiza do servidor. Sessão perdida (expiração
 * ou logout em outra aba, via SIGNED_OUT) → volta a anônimo sem F5; login em
 * outra aba → aparece logado. Sessão coerente com o HTML → nenhum refresh
 * (caminho feliz e TOKEN_REFRESHED periódico ficam intocados).
 */
export function AuthSync({ serverLogado }: { serverLogado: boolean }) {
  const router = useRouter();
  // Guarda anti-loop: o valor de `serverLogado` para o qual JÁ disparamos um
  // refresh. Enquanto o servidor não mudar de ideia, não repetimos — evita
  // loop no caso raro em que o refresh não resolve o descompasso (ex.: cookie
  // válido no servidor mas sessão nula no cliente). Rearma sozinho quando a
  // sessão volta a bater com o HTML.
  const refreshedFor = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const clientLogado = Boolean(session);
      if (clientLogado === serverLogado) {
        refreshedFor.current = null; // coerente de novo → rearma a guarda
        return;
      }
      if (refreshedFor.current === serverLogado) return; // já tentei p/ este estado
      refreshedFor.current = serverLogado;
      router.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [serverLogado, router]);

  return null;
}
