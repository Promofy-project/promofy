import { buscarUsuariosAdmin } from "@/lib/data/admin";
import { formatBRL, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";

import { UsuariosAdminClient } from "./usuarios-client";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const usuarios = await buscarUsuariosAdmin();
  const totalEconomia = usuarios.reduce((s, u) => s + u.economiaTotal, 0);
  const totalCupons = usuarios.reduce((s, u) => s + u.cuponsUsados.length, 0);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Base de consumidores — clique em um usuário para ver os detalhes."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total de usuários"
          value={String(usuarios.length)}
          icon="Users"
        />
        <MetricCard
          label="Economia gerada"
          value={formatBRL(totalEconomia)}
          icon="TrendingUp"
        />
        <MetricCard
          label="Cupons resgatados"
          value={formatNumber(totalCupons)}
          icon="Ticket"
        />
      </div>

      <div className="mt-6">
        <UsuariosAdminClient usuarios={usuarios} />
      </div>
    </>
  );
}
