import { buscarCuponsAdmin } from "@/lib/data/admin";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";

import { CuponsAdminClient } from "./cupons-client";

export const dynamic = "force-dynamic";

export default async function AdminCuponsPage() {
  const cupons = await buscarCuponsAdmin();
  const pendentes = cupons.filter((c) => c.status === "pendente").length;
  const ativos = cupons.filter((c) => c.status === "ativo").length;
  const rejeitados = cupons.filter((c) => c.status === "rejeitado").length;

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Moderação de cupons — aprove ou rejeite as submissões dos estabelecimentos."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Aguardando aprovação"
          value={String(pendentes)}
          icon="Eye"
        />
        <MetricCard label="Ativos" value={String(ativos)} icon="Ticket" />
        <MetricCard label="Rejeitados" value={String(rejeitados)} icon="Store" />
      </div>

      <div className="mt-6">
        <CuponsAdminClient cupons={cupons} />
      </div>
    </>
  );
}
