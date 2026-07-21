import { buscarEstabelecimentosAdmin } from "@/lib/data/admin";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";

import { EstabAdminClient } from "./estab-client";

export const dynamic = "force-dynamic";

export default async function AdminEstabelecimentosPage() {
  const estabelecimentos = await buscarEstabelecimentosAdmin();
  const ativos = estabelecimentos.filter((e) => e.status === "ativo").length;
  const pendentes = estabelecimentos.filter((e) => e.status === "pendente").length;
  const suspensos = estabelecimentos.filter((e) => e.status === "suspenso").length;

  return (
    <>
      <PageHeader
        title="Estabelecimentos"
        description="Aprovação e suspensão de parceiros. Suspender remove os cupons do catálogo público."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Ativos" value={String(ativos)} icon="TrendingUp" />
        <MetricCard label="Pendentes" value={String(pendentes)} icon="Eye" />
        <MetricCard label="Suspensos" value={String(suspensos)} icon="Store" />
      </div>

      <div className="mt-6">
        <EstabAdminClient estabelecimentos={estabelecimentos} />
      </div>
    </>
  );
}
