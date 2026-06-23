import Link from "next/link";
import { Trophy } from "lucide-react";

import { usuarios, estabelecimentos } from "@/lib/mock-data";
import { Podium } from "@/components/podium";

export function RankingBlock() {
  const topEstabelecimentos = [...estabelecimentos]
    .sort((a, b) => b.resgatesMes - a.resgatesMes)
    .slice(0, 3)
    .map((e) => ({ nome: e.nome }));

  const topConsumidores = [...usuarios]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 3)
    .map((u) => ({ nome: u.nome }));

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-card">
      <h2 className="mb-4 text-center text-lg font-extrabold text-primary">
        Ranking
      </h2>

      <div className="flex items-end gap-1">
        <Podium titulo="Estabelecimentos" entries={topEstabelecimentos} />

        {/* Troféu central → Premiações */}
        <Link
          href="/m/premiacoes"
          className="flex shrink-0 flex-col items-center px-1 pb-1 transition-transform hover:scale-105"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#FACC15] to-[#E6A700] shadow-md">
            <Trophy className="h-6 w-6 text-white" />
          </span>
          <span className="mt-1 text-[11px] font-bold text-foreground">
            Premios
          </span>
        </Link>

        <Podium titulo="Consumidores" entries={topConsumidores} />
      </div>
    </section>
  );
}
