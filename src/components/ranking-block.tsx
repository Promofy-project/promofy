import Link from "next/link";
import { Trophy } from "lucide-react";

/**
 * Pódio público. Os nomes vinham de `mock-data` (resgatesMes / pontos
 * inventados) e apareciam como ranking real. Sem dado agregado verdadeiro,
 * o honesto é não fingir.
 */
export function RankingBlock() {
  return (
    <section className="rounded-card border border-dashed border-border bg-card p-4 text-center shadow-card">
      <h2 className="text-lg font-extrabold text-primary">Ranking</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        O ranking de estabelecimentos e consumidores ainda não está no ar.
      </p>
      <Link
        href="/m/premiacoes"
        className="mt-4 inline-flex flex-col items-center gap-1 text-foreground transition-transform hover:scale-105"
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#FACC15] to-[#E6A700] shadow-md">
          <Trophy className="h-6 w-6 text-white" />
        </span>
        <span className="text-[11px] font-bold">Premiações</span>
      </Link>
    </section>
  );
}
