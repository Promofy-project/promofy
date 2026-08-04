"use client";

import * as React from "react";

/**
 * Relógio da status bar das molduras de aparelho (Fase 8/E1).
 *
 * Substitui o `9:41` literal — o horário do keynote da Apple — que estava em
 * três frames e aparecia em telas reais desde a Fase 3.
 *
 * CLIENT-ONLY APÓS MONTAGEM, e isso não é preciosismo. As Fases 4 e 5 pagaram
 * por hidratação quebrada com valores dependentes de tempo/fuso: o servidor
 * renderiza em UTC (Vercel) e o navegador em UTC-3, o HTML diverge e o React
 * derruba a árvore (#418/#423/#425). Aqui o primeiro render — servidor e
 * cliente — devolve o MESMO placeholder, e só depois de montado o horário
 * aparece. Nenhum `Date` é lido durante a renderização inicial.
 */
export function RelogioStatusBar() {
  const [hora, setHora] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ler = () =>
      setHora(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        }),
      );
    ler();
    // Atualiza a cada 30s: o minuto vira sem depender de navegação, e não
    // custa nada. Limpo no unmount.
    const t = window.setInterval(ler, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // `suppressHydrationWarning` não é usado aqui de propósito: ele mascararia
  // divergência em vez de evitá-la. O placeholder é a solução.
  return <span className="tabular-nums">{hora ?? "--:--"}</span>;
}
