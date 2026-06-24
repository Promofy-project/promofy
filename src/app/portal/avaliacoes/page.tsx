import { avaliacoes } from "@/lib/mock-data";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { ReviewCard } from "@/components/review-card";

export default function PortalAvaliacoes() {
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
        <MetricCard label="NPS médio recebido" value="8,7" icon="TrendingUp" />
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
