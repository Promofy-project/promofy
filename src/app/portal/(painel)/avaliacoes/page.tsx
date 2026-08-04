import { avaliacoes } from "@/lib/mock-data";
import { buscarIndicadores } from "@/lib/data/indicadores";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { ReviewCard } from "@/components/review-card";

export const dynamic = "force-dynamic";

export default async function PortalAvaliacoes() {
  // Fase 8/M2 — o NPS deixa de ser inventado. O card exibia "8,7" HARDCODED
  // desde a Fase 3; agora vem da mesma RPC que alimenta o /e/indicadores.
  // (Os cards de avaliação abaixo seguem vindo do mock — são as reviews em
  // texto, que ainda não existem no banco. Está no backlog.)
  const ind = await buscarIndicadores();
  const total = avaliacoes.length;
  const media = avaliacoes.reduce((s, a) => s + a.rating, 0) / (total || 1);
  const mediaFmt = media.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="O que os clientes estão dizendo sobre o Sabor & Cia."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Avaliação média" value={mediaFmt} icon="Star" />
        <MetricCard
          label="NPS recebido"
          value={ind.temDados ? String(ind.score) : "—"}
          icon="TrendingUp"
        />
        <MetricCard
          label="Total de avaliações"
          value={String(total)}
          icon="Users"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {avaliacoes.map((a) => (
          <ReviewCard key={a.id} avaliacao={a} />
        ))}
      </div>
    </>
  );
}
